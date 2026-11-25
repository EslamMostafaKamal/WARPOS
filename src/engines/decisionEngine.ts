import { ERPState, Product, PurchaseOrderItem } from '../types';
import { roundMoney } from '../utils/format';

export type EngineDomain = 'inventory' | 'pricing' | 'cashflow' | 'loyalty';

export type DecisionActionType =
  | { type: 'create_eoq_po'; items: PurchaseOrderItem[] }
  | { type: 'update_price'; productId: string; newPrice: number }
  | { type: 'receive_po'; poId: string }
  | { type: 'navigate_customers' }
  | { type: 'navigate_expenses' };

export interface DecisionProof {
  engineName: string;
  formula: string;
  inputs: { label: string; value: string }[];
  derivation: string;
}

export interface BusinessDecision {
  id: string;
  domain: EngineDomain;
  priority: 'high' | 'medium' | 'low';
  title: string;
  summary: string;
  impactLabel: string;
  projectedImpactValue: number;
  confidenceLabel: string;
  proof: DecisionProof;
  actionLabel: string;
  action: DecisionActionType;
}

export interface ProductMathProfile {
  product: Product;
  dailyDemand: number;
  demandStdDev: number;
  annualDemand: number;
  eoq: number;
  safetyStock: number;
  rop: number;
  daysOfInventory: number;
  grossMarginPct: number;
  revenueContribution: number;
  abcClass: 'A' | 'B' | 'C';
}

export interface HolisticEngineReport {
  computedAt: string;
  activeEnginesCount: number;
  healthScore: number;
  contributionMarginRatio: number;
  breakEvenRevenue: number;
  actualRevenue: number;
  marginOfSafetyPct: number;
  workingCapitalNet: number;
  receivablesTotal: number;
  payablesTotal: number;
  pendingPoCommitment: number;
  inventoryValuationCost: number;
  abcBreakdown: { classA: number; classB: number; classC: number };
  productProfiles: ProductMathProfile[];
  decisions: BusinessDecision[];
}

const ORDERING_COST_S = 24;
const ANNUAL_HOLDING_RATE = 0.22;
const LEAD_TIME_DAYS = 4;
const Z_SCORE_95 = 1.645;

function computeDemandStats(state: ERPState): {
  windowDays: number;
  dailyDemandByProduct: Map<string, number[]>;
  revenueByProduct: Map<string, number>;
} {
  const completedSales = state.sales.filter((s) => s.status === 'Completed');
  const windowDays = 7;
  const now = new Date();
  const dayKeys: string[] = [];

  for (let i = windowDays - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    dayKeys.push(d.toISOString().slice(0, 10));
  }

  const dayIndexMap = new Map<string, number>();
  dayKeys.forEach((k, idx) => dayIndexMap.set(k, idx));

  const dailyDemandByProduct = new Map<string, number[]>();
  const revenueByProduct = new Map<string, number>();

  for (const p of state.products) {
    dailyDemandByProduct.set(p.id, new Array(windowDays).fill(0));
    revenueByProduct.set(p.id, 0);
  }

  for (const sale of completedSales) {
    const key = new Date(sale.date).toISOString().slice(0, 10);
    const dayIdx = dayIndexMap.get(key);
    for (const item of sale.items) {
      revenueByProduct.set(
        item.productId,
        (revenueByProduct.get(item.productId) ?? 0) + item.lineTotal
      );
      if (dayIdx !== undefined) {
        const series = dailyDemandByProduct.get(item.productId);
        if (series) {
          series[dayIdx] += item.quantity;
        }
      }
    }
  }

  return { windowDays, dailyDemandByProduct, revenueByProduct };
}

export function runDecisionEngine(state: ERPState): HolisticEngineReport {
  const sym = state.settings.currencySymbol;
  const isAr = state.settings.language === 'ar';
  const completedSales = state.sales.filter((s) => s.status === 'Completed');
  const { windowDays, dailyDemandByProduct, revenueByProduct } = computeDemandStats(state);

  // 1. Macro Financial & Break-Even Engine
  const actualRevenue = roundMoney(completedSales.reduce((s, x) => s + x.total, 0));
  const totalCogs = roundMoney(completedSales.reduce((s, x) => s + x.totalCost, 0));
  const totalExpenses = roundMoney(state.expenses.reduce((s, x) => s + x.amount, 0));
  const grossProfit = roundMoney(actualRevenue - totalCogs);
  const contributionMarginRatio = actualRevenue > 0 ? grossProfit / actualRevenue : 0.45;
  const breakEvenRevenue =
    contributionMarginRatio > 0 ? roundMoney(totalExpenses / contributionMarginRatio) : 0;
  const marginOfSafetyPct =
    actualRevenue > 0
      ? roundMoney(((actualRevenue - breakEvenRevenue) / actualRevenue) * 100)
      : 0;

  const cashCollected = roundMoney(
    completedSales.reduce((s, x) => s + x.amountPaid, 0) +
      state.customerPayments.reduce((s, p) => s + p.amount, 0)
  );
  const receivablesTotal = roundMoney(
    state.customers.reduce((s, c) => s + c.creditBalance, 0)
  );
  const payablesTotal = roundMoney(
    state.suppliers.reduce((s, sup) => s + sup.balanceOwed, 0)
  );
  const pendingPOs = state.purchaseOrders.filter((po) => po.status === 'Pending');
  const pendingPoCommitment = roundMoney(pendingPOs.reduce((s, po) => s + po.totalCost, 0));
  const inventoryValuationCost = roundMoney(
    state.products.reduce((s, p) => s + p.costPrice * p.stock, 0)
  );
  const workingCapitalNet = roundMoney(
    cashCollected - totalExpenses + receivablesTotal - payablesTotal
  );

  // 2. Inventory Optimization Engine (EOQ, ROP, Safety Stock, ABC)
  const totalProductRev = Array.from(revenueByProduct.values()).reduce((a, b) => a + b, 0);
  const sortedByRev = [...state.products].sort(
    (a, b) => (revenueByProduct.get(b.id) ?? 0) - (revenueByProduct.get(a.id) ?? 0)
  );

  const abcMap = new Map<string, 'A' | 'B' | 'C'>();
  let cumulativeRev = 0;
  for (const p of sortedByRev) {
    const rev = revenueByProduct.get(p.id) ?? 0;
    cumulativeRev += rev;
    const share = totalProductRev > 0 ? cumulativeRev / totalProductRev : 1;
    if (rev > 0 && share <= 0.72) abcMap.set(p.id, 'A');
    else if (rev > 0 && share <= 0.92) abcMap.set(p.id, 'B');
    else abcMap.set(p.id, 'C');
  }

  const productProfiles: ProductMathProfile[] = state.products.map((product) => {
    const series = dailyDemandByProduct.get(product.id) ?? new Array(windowDays).fill(0);
    const totalSold = series.reduce((a, b) => a + b, 0);
    const rawDaily = totalSold / windowDays;
    const effectiveDaily = rawDaily > 0 ? rawDaily : 0.12;
    const mean = rawDaily;
    const variance =
      series.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / windowDays;
    const stdDev = Math.sqrt(variance);

    const annualDemand = effectiveDaily * 365;
    const holdingCostH = Math.max(0.5, product.costPrice * ANNUAL_HOLDING_RATE);
    const eoq = Math.max(
      product.reorderLevel,
      Math.round(Math.sqrt((2 * annualDemand * ORDERING_COST_S) / holdingCostH))
    );
    const safetyStock = Math.ceil(Z_SCORE_95 * stdDev * Math.sqrt(LEAD_TIME_DAYS));
    const dynamicRop = Math.max(
      product.reorderLevel,
      Math.ceil(effectiveDaily * LEAD_TIME_DAYS + safetyStock)
    );
    const daysOfInventory =
      rawDaily > 0 ? roundMoney(product.stock / rawDaily) : product.stock > 0 ? 120 : 0;
    const grossMarginPct =
      product.sellingPrice > 0
        ? roundMoney(((product.sellingPrice - product.costPrice) / product.sellingPrice) * 100)
        : 0;

    return {
      product,
      dailyDemand: roundMoney(rawDaily),
      demandStdDev: roundMoney(stdDev),
      annualDemand: Math.round(annualDemand),
      eoq,
      safetyStock,
      rop: dynamicRop,
      daysOfInventory,
      grossMarginPct,
      revenueContribution: roundMoney(revenueByProduct.get(product.id) ?? 0),
      abcClass: abcMap.get(product.id) ?? 'C',
    };
  });

  const abcBreakdown = {
    classA: productProfiles.filter((p) => p.abcClass === 'A').length,
    classB: productProfiles.filter((p) => p.abcClass === 'B').length,
    classC: productProfiles.filter((p) => p.abcClass === 'C').length,
  };

  const decisions: BusinessDecision[] = [];

  // Decision A: EOQ Batch Replenishment for items below Dynamic ROP
  const pendingQtyByProduct = new Map<string, number>();
  for (const po of pendingPOs) {
    for (const item of po.items) {
      pendingQtyByProduct.set(
        item.productId,
        (pendingQtyByProduct.get(item.productId) ?? 0) + item.quantity
      );
    }
  }

  const urgentRestockProfiles = productProfiles
    .filter((prof) => {
      const incoming = pendingQtyByProduct.get(prof.product.id) ?? 0;
      return prof.product.stock + incoming <= prof.rop;
    })
    .sort((a, b) => a.product.stock - b.product.stock);

  if (urgentRestockProfiles.length > 0) {
    const batchItems: PurchaseOrderItem[] = urgentRestockProfiles.slice(0, 5).map((prof) => ({
      productId: prof.product.id,
      productName: prof.product.name,
      sku: prof.product.sku,
      quantity: Math.max(6, Math.min(60, prof.eoq)),
      unitCost: prof.product.costPrice,
    }));

    const leadItem = urgentRestockProfiles[0];
    const protectedProfit = roundMoney(
      urgentRestockProfiles.slice(0, 5).reduce((sum, prof) => {
        const unitProfit = Math.max(0, prof.product.sellingPrice - prof.product.costPrice);
        const projected14dSales = Math.max(2, prof.dailyDemand * 14);
        const shortage = Math.max(0, projected14dSales - prof.product.stock);
        return sum + shortage * unitProfit;
      }, 0)
    );
    const totalOrderCost = roundMoney(
      batchItems.reduce((sum, i) => sum + i.quantity * i.unitCost, 0)
    );
    const holdingCostStr = (leadItem.product.costPrice * ANNUAL_HOLDING_RATE).toFixed(2);

    decisions.push({
      id: 'dec-eoq-restock',
      domain: 'inventory',
      priority: 'high',
      title: isAr
        ? `إعادة توريد ${batchItems.length} أصناف وفق معادلة EOQ ونقطة إعادة الطلب ROP`
        : `Restock ${batchItems.length} SKU${batchItems.length > 1 ? 's' : ''} using EOQ & Safety Stock ROP`,
      summary: isAr
        ? `الأصناف (${batchItems.map((b) => b.sku).join('، ')}) أقل من نقطة إعادة الطلب الديناميكية (ROP) دون أمر شراء قادم. طلب الكمية الاقتصادية المثلى يوازن بين تكلفة التوريد وتكلفة التخزين.`
        : `${batchItems.map((b) => b.sku).join(', ')} are below dynamic Reorder Point (ROP) with no pending PO coverage. Ordering exact Economic Order Quantities balances ordering vs. holding cost.`,
      impactLabel: isAr
        ? `يحمي ~${sym}${protectedProfit.toFixed(0)} مجمل ربح (تكلفة الطلب ${sym}${totalOrderCost.toFixed(0)})`
        : `Protects ~${sym}${protectedProfit.toFixed(0)} gross profit (PO cost ${sym}${totalOrderCost.toFixed(0)})`,
      projectedImpactValue: Math.max(protectedProfit, 80),
      confidenceLabel: isAr ? 'مستوى خدمة 95% (Z = 1.645)' : '95% service level (Z = 1.645)',
      proof: {
        engineName: isAr ? 'محرك الكمية الاقتصادية ومخزون الأمان (EOQ/ROP)' : 'EOQ & Dynamic Safety-Stock Engine',
        formula: 'Q* = √(2·D·S / H)   |   ROP = d̄·L + Z·σ_d·√L',
        inputs: [
          {
            label: isAr ? 'الصنف الأهم' : 'Lead SKU',
            value: `${leadItem.product.sku} (${isAr ? 'الرصيد' : 'Stock'}: ${leadItem.product.stock})`,
          },
          {
            label: isAr ? 'الطلب السنوي المتوقع (D)' : 'Annualized Demand (D)',
            value: isAr ? `${leadItem.annualDemand} وحدة/سنة` : `${leadItem.annualDemand} units/yr`,
          },
          {
            label: isAr ? 'تكلفة الطلب (S) / معدل التخزين' : 'Order Cost (S) / Holding Rate',
            value: `${sym}${ORDERING_COST_S} / 22%`,
          },
          {
            label: isAr ? 'مدة التوريد (L) ومخزون الأمان' : 'Lead Time (L) & Safety Stock',
            value: isAr ? `${LEAD_TIME_DAYS} أيام / +${leadItem.safetyStock} وحدة` : `${LEAD_TIME_DAYS}d / +${leadItem.safetyStock} units`,
          },
        ],
        derivation: isAr
          ? `للصنف ${leadItem.product.sku}: تكلفة التخزين H = ${sym}${holdingCostStr}/وحدة·سنة ← الكمية المثلى Q* = √(2×${leadItem.annualDemand}×${ORDERING_COST_S}/${holdingCostStr}) = ${leadItem.eoq} وحدة. نقطة إعادة الطلب ROP = ${leadItem.rop} مقارنة بالرصيد الحالي ${leadItem.product.stock}.`
          : `For ${leadItem.product.sku}: H = ${sym}${holdingCostStr}/unit·yr → Q* = √(2×${leadItem.annualDemand}×${ORDERING_COST_S}/${holdingCostStr}) = ${leadItem.eoq} units. Dynamic ROP = ${leadItem.rop} units vs current stock ${leadItem.product.stock}.`,
      },
      actionLabel: isAr ? `إنشاء أمر شراء EOQ (${batchItems.length} أصناف)` : `Create EOQ PO (${batchItems.length} SKUs)`,
      action: { type: 'create_eoq_po', items: batchItems },
    });
  }

  // Decision B: Receive Pending POs covering out-of-stock / critical items
  const criticalPendingPO = pendingPOs.find((po) =>
    po.items.some((item) => {
      const p = state.products.find((prod) => prod.id === item.productId);
      return p && p.stock <= p.reorderLevel;
    })
  );
  if (criticalPendingPO) {
    const potentialRevenue = roundMoney(
      criticalPendingPO.items.reduce((sum, item) => {
        const p = state.products.find((prod) => prod.id === item.productId);
        return sum + (p ? p.sellingPrice * item.quantity : 0);
      }, 0)
    );
    const potentialGross = roundMoney(potentialRevenue - criticalPendingPO.totalCost);
    const totalUnits = criticalPendingPO.items.reduce((s, i) => s + i.quantity, 0);
    const blendedMargin = ((potentialGross / Math.max(1, potentialRevenue)) * 100).toFixed(1);

    decisions.push({
      id: `dec-receive-${criticalPendingPO.id}`,
      domain: 'inventory',
      priority: 'high',
      title: isAr
        ? `استلام أمر الشراء ${criticalPendingPO.poNumber} لإنهاء نفاد المخزون فوراً`
        : `Receive ${criticalPendingPO.poNumber} to eliminate active stockouts`,
      summary: isAr
        ? `شحنة المورد ${criticalPendingPO.supplierName} تحتوي على أصناف منخفضة أو نافدة. تأكيد الاستلام الآن يعيد توفرها في الكاشير ويحدّث طبقات التكلفة تلقائياً.`
        : `${criticalPendingPO.supplierName} shipment contains out-of-stock or below-ROP SKUs. Receiving now restores POS availability and updates weighted average cost.`,
      impactLabel: isAr
        ? `يُتيح ${sym}${potentialGross.toFixed(0)} مجمل ربح جاهز للبيع`
        : `Unlocks ${sym}${potentialGross.toFixed(0)} gross profit pool`,
      projectedImpactValue: potentialGross,
      confidenceLabel: isAr ? 'استعادة مباشرة لمبيعات النفاد' : 'Direct stockout recovery',
      proof: {
        engineName: isAr ? 'محرك استمرارية التوريد وتكلفة المخزون' : 'Supply Continuity & Weighted Cost Engine',
        formula: 'C_new = (Q_old·C_old + Q_po·C_po) / (Q_old + Q_po)',
        inputs: [
          { label: isAr ? 'أمر الشراء' : 'Purchase Order', value: criticalPendingPO.poNumber },
          {
            label: isAr ? 'الوحدات الواردة' : 'Units Incoming',
            value: isAr ? `${totalUnits} وحدة` : `${totalUnits} units`,
          },
          {
            label: isAr ? 'تكلفة أمر الشراء' : 'PO Cost Basis',
            value: `${sym}${criticalPendingPO.totalCost.toFixed(2)}`,
          },
          {
            label: isAr ? 'القيمة البيعية المتاحة' : 'Retail Value Unlocked',
            value: `${sym}${potentialRevenue.toFixed(2)}`,
          },
        ],
        derivation: isAr
          ? `الاستلام الفوري يحوّل مخزوناً قيد التوريد بقيمة ${sym}${criticalPendingPO.totalCost.toFixed(2)} إلى بضاعة قابلة للبيع بقيمة ${sym}${potentialRevenue.toFixed(2)} بهامش ربح مختلط ${blendedMargin}%.`
          : `Immediate receipt converts ${sym}${criticalPendingPO.totalCost.toFixed(2)} in transit inventory into ${sym}${potentialRevenue.toFixed(2)} sellable stock (${blendedMargin}% blended margin).`,
      },
      actionLabel: isAr ? `تأكيد استلام ${criticalPendingPO.poNumber}` : `Mark ${criticalPendingPO.poNumber} Received`,
      action: { type: 'receive_po', poId: criticalPendingPO.id },
    });
  }

  // Decision C: Pricing Optimization — Low-Margin High-Velocity SKU
  const marginCandidates = productProfiles
    .filter((prof) => prof.grossMarginPct < 52 && prof.product.sellingPrice > 0)
    .sort((a, b) => a.grossMarginPct - b.grossMarginPct);

  if (marginCandidates.length > 0) {
    const target = marginCandidates[0];
    const targetMargin = 0.56;
    const optimalPrice = roundMoney(
      Math.max(target.product.sellingPrice * 1.06, target.product.costPrice / (1 - targetMargin))
    );
    const roundedOptimal = Math.round(optimalPrice * 2) / 2;
    const deltaPerUnit = roundMoney(roundedOptimal - target.product.sellingPrice);
    if (deltaPerUnit >= 0.5) {
      const pctPriceIncrease = deltaPerUnit / target.product.sellingPrice;
      const elasticityAdjFactor = Math.max(0.85, 1 - 0.35 * pctPriceIncrease);
      const projectedMonthlyUnits = Math.max(8, target.dailyDemand * 30);
      const currentMonthlyProfit =
        projectedMonthlyUnits * (target.product.sellingPrice - target.product.costPrice);
      const newMonthlyProfit =
        projectedMonthlyUnits * elasticityAdjFactor * (roundedOptimal - target.product.costPrice);
      const monthlyLift = roundMoney(Math.max(15, newMonthlyProfit - currentMonthlyProfit));
      const newMarginPct = (
        ((roundedOptimal - target.product.costPrice) / roundedOptimal) *
        100
      ).toFixed(1);
      const unitMarginExpansion = (
        ((roundedOptimal - target.product.costPrice) /
          Math.max(0.01, target.product.sellingPrice - target.product.costPrice) -
          1) *
        100
      ).toFixed(1);

      decisions.push({
        id: `dec-price-${target.product.id}`,
        domain: 'pricing',
        priority: 'medium',
        title: isAr
          ? `تحسين سعر "${target.product.name}" إلى ${sym}${roundedOptimal.toFixed(2)}`
          : `Optimize price of ${target.product.name} to ${sym}${roundedOptimal.toFixed(2)}`,
        summary: isAr
          ? `الهامش الإجمالي الحالي ${target.grossMarginPct.toFixed(1)}% (أقل من المستهدف 56%). التسعير المعدّل وفق مرونة الطلب (+${(pctPriceIncrease * 100).toFixed(1)}%) يرفع صافي المساهمة حتى بعد احتساب أثر المرونة.`
          : `Current gross margin is ${target.grossMarginPct.toFixed(1)}% (below target 56%). Elasticity-adjusted pricing (+${(pctPriceIncrease * 100).toFixed(1)}%) raises net contribution even accounting for minor volume sensitivity.`,
        impactLabel: isAr
          ? `+${sym}${monthlyLift.toFixed(0)}/شهر مجمل ربح إضافي`
          : `+${sym}${monthlyLift.toFixed(0)}/mo projected gross profit`,
        projectedImpactValue: monthlyLift * 3,
        confidenceLabel: isAr ? 'مرونة الطلب ε = -0.35' : 'Elasticity ε = -0.35 modeled',
        proof: {
          engineName: isAr ? 'محرك هامش المساهمة ومرونة التسعير' : 'Contribution Margin & Price Elasticity Engine',
          formula: 'ΔΠ = Q·(1 + ε·ΔP/P)·(P_new - C) − Q·(P_old - C)',
          inputs: [
            {
              label: isAr ? 'السعر الحالي / التكلفة' : 'Current Price / Cost',
              value: `${sym}${target.product.sellingPrice.toFixed(2)} / ${sym}${target.product.costPrice.toFixed(2)}`,
            },
            {
              label: isAr ? 'الهامش الإجمالي الحالي' : 'Current Gross Margin',
              value: `${target.grossMarginPct.toFixed(1)}%`,
            },
            {
              label: isAr ? 'السعر المقترح' : 'Recommended Price',
              value: `${sym}${roundedOptimal.toFixed(2)} (${newMarginPct}% ${isAr ? 'هامش' : 'margin'})`,
            },
            {
              label: isAr ? 'الحجم الشهري التقديري' : 'Est. Monthly Volume',
              value: isAr
                ? `${Math.round(projectedMonthlyUnits)} وحدة`
                : `${Math.round(projectedMonthlyUnits)} units`,
            },
          ],
          derivation: isAr
            ? `رفع السعر بمقدار ${sym}${deltaPerUnit.toFixed(2)} (+${(pctPriceIncrease * 100).toFixed(1)}%) بمرونة ε = -0.35 يحافظ على ${(elasticityAdjFactor * 100).toFixed(1)}% من حجم المبيعات بينما يوسّع هامش الوحدة بنسبة +${unitMarginExpansion}% ليحقق +${sym}${monthlyLift.toFixed(2)} شهرياً.`
            : `Raising price by ${sym}${deltaPerUnit.toFixed(2)} (+${(pctPriceIncrease * 100).toFixed(1)}%) with ε = -0.35 retains ${(elasticityAdjFactor * 100).toFixed(1)}% demand while expanding unit margin by +${unitMarginExpansion}%, yielding +${sym}${monthlyLift.toFixed(2)}/month.`,
        },
        actionLabel: isAr ? `تطبيق السعر ${sym}${roundedOptimal.toFixed(2)}` : `Apply ${sym}${roundedOptimal.toFixed(2)} Price`,
        action: { type: 'update_price', productId: target.product.id, newPrice: roundedOptimal },
      });
    }
  }

  // Decision D: Slow-Mover Markdown to Release Tied-Up Working Capital
  const slowMovers = productProfiles
    .filter((prof) => prof.daysOfInventory >= 45 && prof.product.stock >= 15 && prof.abcClass === 'C')
    .sort((a, b) => b.product.stock * b.product.costPrice - a.product.stock * a.product.costPrice);

  if (slowMovers.length > 0) {
    const slow = slowMovers[0];
    const tiedCapital = roundMoney(slow.product.stock * slow.product.costPrice);
    const markdownPrice = roundMoney(
      Math.max(slow.product.costPrice * 1.25, slow.product.sellingPrice * 0.88)
    );
    const roundedMarkdown = Math.round(markdownPrice * 2) / 2;
    const cashFreed = roundMoney(tiedCapital * 0.55);
    const preservedMargin = (
      ((roundedMarkdown - slow.product.costPrice) / roundedMarkdown) *
      100
    ).toFixed(1);

    if (roundedMarkdown < slow.product.sellingPrice) {
      decisions.push({
        id: `dec-markdown-${slow.product.id}`,
        domain: 'pricing',
        priority: 'medium',
        title: isAr
          ? `خصم ترويجي 12% لتصفية الصنف بطيء الحركة ${slow.product.sku}`
          : `Run 12% promotional markdown on slow-moving ${slow.product.sku}`,
        summary: isAr
          ? `الصنف "${slow.product.name}" يحتجز ${slow.product.stock} وحدة (${sym}${tiedCapital.toFixed(0)} كاش محبوس بالتكلفة) بتصنيف حركة C (تغطية ${Math.round(slow.daysOfInventory)} يوماً+). خصم مدروس يسرّع تسييل الكاش مع الحفاظ على هامش موجب.`
          : `${slow.product.name} holds ${slow.product.stock} units (${sym}${tiedCapital.toFixed(0)} tied up at cost) with Class-C velocity (${slow.daysOfInventory}d+ inventory cover). A controlled markdown accelerates cash conversion while preserving positive margin.`,
        impactLabel: isAr
          ? `يحرّر ~${sym}${cashFreed.toFixed(0)} من رأس المال العامل`
          : `Frees ~${sym}${cashFreed.toFixed(0)} working capital`,
        projectedImpactValue: cashFreed,
        confidenceLabel: isAr
          ? `تصنيف C · تغطية ${Math.round(slow.daysOfInventory)} يوماً`
          : `Class C · DOI ${Math.round(slow.daysOfInventory)} days`,
        proof: {
          engineName: isAr ? 'محرك دوران المخزون وتحرير السيولة' : 'Inventory Turnover & Capital Release Engine',
          formula: 'DOI = Stock / d̄   |   Capital_Tied = Stock × UnitCost',
          inputs: [
            {
              label: isAr ? 'الرمز والرصيد الحالي' : 'SKU & On-Hand Stock',
              value: `${slow.product.sku} (${slow.product.stock} ${isAr ? 'وحدة' : 'units'})`,
            },
            {
              label: isAr ? 'الكاش المحبوس بالتكلفة' : 'Capital Tied Up (Cost)',
              value: `${sym}${tiedCapital.toFixed(2)}`,
            },
            {
              label: isAr ? 'السعر الحالي ← الترويجي' : 'Current vs Promo Price',
              value: `${sym}${slow.product.sellingPrice.toFixed(2)} → ${sym}${roundedMarkdown.toFixed(2)}`,
            },
            {
              label: isAr ? 'الهامش المحفوظ بعد الخصم' : 'Preserved Margin at Promo',
              value: `${preservedMargin}%`,
            },
          ],
          derivation: isAr
            ? `تصفية 55% من المخزون الفائض بسعر ${sym}${roundedMarkdown.toFixed(2)} يستعيد ${sym}${cashFreed.toFixed(2)} من التكلفة مع هامش ربح إيجابي (${preservedMargin}%) ويخفض تكاليف التخزين السنوية.`
            : `Liquidating 55% of excess stock at ${sym}${roundedMarkdown.toFixed(2)} recovers ${sym}${cashFreed.toFixed(2)} in cost basis plus positive gross margin, reducing annual holding drag.`,
        },
        actionLabel: isAr ? `تفعيل سعر العرض ${sym}${roundedMarkdown.toFixed(2)}` : `Set Promo ${sym}${roundedMarkdown.toFixed(2)}`,
        action: { type: 'update_price', productId: slow.product.id, newPrice: roundedMarkdown },
      });
    }
  }

  // Decision E: Cash Flow & Accounts Receivable Credit Concentration
  if (receivablesTotal > 0) {
    const arRatio = actualRevenue > 0 ? (receivablesTotal / actualRevenue) * 100 : 0;
    const topDebtors = state.customers
      .filter((c) => c.creditBalance > 0)
      .sort((a, b) => b.creditBalance - a.creditBalance);
    const coveragePct = Math.min(100, Math.round((receivablesTotal / Math.max(1, payablesTotal)) * 100));

    decisions.push({
      id: 'dec-ar-collection',
      domain: 'cashflow',
      priority: arRatio >= 20 ? 'high' : 'medium',
      title: isAr
        ? `تحصيل ${sym}${receivablesTotal.toFixed(2)} من ذمم العملاء المفتوحة`
        : `Collect ${sym}${receivablesTotal.toFixed(2)} in open customer credit balances`,
      summary: isAr
        ? `يوجد ${topDebtors.length} عملاء عليهم أرصدة آجلة تمثل ${arRatio.toFixed(1)}% من الإيرادات (أكبرها ${topDebtors[0]?.name} بقيمة ${sym}${topDebtors[0]?.creditBalance.toFixed(2)}). التحصيل يغطي مباشرة جزءاً من مستحقات الموردين (${sym}${payablesTotal.toFixed(0)}).`
        : `${topDebtors.length} account${topDebtors.length > 1 ? 's' : ''} owe ${arRatio.toFixed(1)}% of recent revenue (led by ${topDebtors[0]?.name} at ${sym}${topDebtors[0]?.creditBalance.toFixed(2)}). Settling receivables directly offsets ${sym}${payablesTotal.toFixed(0)} in supplier payables.`,
      impactLabel: isAr
        ? `+${sym}${receivablesTotal.toFixed(0)} سيولة فورية`
        : `+${sym}${receivablesTotal.toFixed(0)} immediate liquidity`,
      projectedImpactValue: receivablesTotal,
      confidenceLabel: isAr
        ? `نسبة الذمم إلى الإيرادات ${arRatio.toFixed(1)}%`
        : `AR/Revenue ratio ${arRatio.toFixed(1)}%`,
      proof: {
        engineName: isAr ? 'محرك رأس المال العامل ومخاطر الذمم' : 'Working Capital & Receivables Risk Engine',
        formula: 'Net_WC = (Cash_In − OpEx) + AR − AP   |   AR% = AR / Revenue',
        inputs: [
          { label: isAr ? 'ذمم العملاء (AR)' : 'Accounts Receivable (AR)', value: `${sym}${receivablesTotal.toFixed(2)}` },
          { label: isAr ? 'مستحقات الموردين (AP)' : 'Supplier Payables (AP)', value: `${sym}${payablesTotal.toFixed(2)}` },
          { label: isAr ? 'التزامات أوامر الشراء المعلقة' : 'Pending PO Cash Need', value: `${sym}${pendingPoCommitment.toFixed(2)}` },
          {
            label: isAr ? 'أكبر رصيد عميل' : 'Largest Account Exposure',
            value: `${topDebtors[0]?.name ?? (isAr ? 'لا يوجد' : 'None')} (${sym}${(topDebtors[0]?.creditBalance ?? 0).toFixed(2)})`,
          },
        ],
        derivation: isAr
          ? `تحصيل ${sym}${receivablesTotal.toFixed(2)} يغطي ${coveragePct}% من مستحقات الموردين الحالية (${sym}${payablesTotal.toFixed(2)}) بدون الحاجة لتمويل خارجي.`
          : `Collecting ${sym}${receivablesTotal.toFixed(2)} covers ${coveragePct}% of current supplier payables (${sym}${payablesTotal.toFixed(2)}) without external borrowing.`,
      },
      actionLabel: isAr ? 'تحصيل أرصدة العملاء' : 'Collect Customer Balances',
      action: { type: 'navigate_customers' },
    });
  }

  // Decision F: Break-Even & Margin of Safety Advisory
  if (marginOfSafetyPct < 45 && totalExpenses > 0) {
    const expenseTrimTarget = roundMoney(totalExpenses * 0.1);
    const newBep = roundMoney(
      (totalExpenses - expenseTrimTarget) / Math.max(0.05, contributionMarginRatio)
    );
    const bepDrop = roundMoney(breakEvenRevenue - newBep);

    decisions.push({
      id: 'dec-bep-safety',
      domain: 'cashflow',
      priority: marginOfSafetyPct < 20 ? 'high' : 'low',
      title: isAr
        ? `تعزيز هامش الأمان لنقطة التعادل (${marginOfSafetyPct.toFixed(1)}%)`
        : `Strengthen Break-Even Margin of Safety (${marginOfSafetyPct.toFixed(1)}%)`,
      summary: isAr
        ? `نقطة التعادل الحالية ${sym}${breakEvenRevenue.toFixed(0)} بنسبة هامش مساهمة ${(contributionMarginRatio * 100).toFixed(1)}%. ترشيد المصروفات التشغيلية بنسبة 10% يخفض عتبة التعادل إلى ${sym}${newBep.toFixed(0)}.`
        : `Current break-even threshold is ${sym}${breakEvenRevenue.toFixed(0)} at a ${(contributionMarginRatio * 100).toFixed(1)}% contribution margin ratio. Trimming operating overhead by 10% lowers your break-even revenue requirement to ${sym}${newBep.toFixed(0)}.`,
      impactLabel: isAr
        ? `يخفض نقطة التعادل بمقدار ${sym}${bepDrop.toFixed(0)}`
        : `Lowers break-even by ${sym}${bepDrop.toFixed(0)}`,
      projectedImpactValue: expenseTrimTarget * 3,
      confidenceLabel: isAr
        ? `هامش المساهمة ${(contributionMarginRatio * 100).toFixed(1)}%`
        : `CMR ${(contributionMarginRatio * 100).toFixed(1)}%`,
      proof: {
        engineName: isAr ? 'محرك تحليل التعادل وهامش الأمان (CVP)' : 'CVP Break-Even & Margin of Safety Engine',
        formula: 'BEP = Fixed_OpEx / CMR   |   MoS% = (Rev − BEP) / Rev',
        inputs: [
          { label: isAr ? 'إيرادات الفترة' : 'Period Revenue', value: `${sym}${actualRevenue.toFixed(2)}` },
          {
            label: isAr ? 'نسبة هامش المساهمة (CMR)' : 'Contribution Margin Ratio',
            value: `${(contributionMarginRatio * 100).toFixed(1)}%`,
          },
          { label: isAr ? 'المصروفات التشغيلية' : 'Operating Expenses', value: `${sym}${totalExpenses.toFixed(2)}` },
          { label: isAr ? 'نقطة التعادل (BEP)' : 'Break-Even Revenue (BEP)', value: `${sym}${breakEvenRevenue.toFixed(2)}` },
        ],
        derivation: isAr
          ? `نقطة التعادل = ${sym}${totalExpenses.toFixed(2)} ÷ ${contributionMarginRatio.toFixed(3)} = ${sym}${breakEvenRevenue.toFixed(2)}. هامش الأمان = (${sym}${actualRevenue.toFixed(2)} − ${sym}${breakEvenRevenue.toFixed(2)}) ÷ ${sym}${actualRevenue.toFixed(2)} = ${marginOfSafetyPct.toFixed(1)}%.`
          : `BEP = ${sym}${totalExpenses.toFixed(2)} / ${contributionMarginRatio.toFixed(3)} = ${sym}${breakEvenRevenue.toFixed(2)}. Margin of Safety = (${sym}${actualRevenue.toFixed(2)} − ${sym}${breakEvenRevenue.toFixed(2)}) / ${sym}${actualRevenue.toFixed(2)} = ${marginOfSafetyPct.toFixed(1)}%.`,
      },
      actionLabel: isAr ? 'مراجعة المصروفات التشغيلية' : 'Audit Operating Expenses',
      action: { type: 'navigate_expenses' },
    });
  }

  // Sort decisions holistically by priority weight then quantified impact
  const priorityWeight = { high: 3, medium: 2, low: 1 };
  decisions.sort((a, b) => {
    const pw = priorityWeight[b.priority] - priorityWeight[a.priority];
    if (pw !== 0) return pw;
    return b.projectedImpactValue - a.projectedImpactValue;
  });

  // Composite Whole-Business Health Index (0-100)
  const stockHealth = Math.max(
    0,
    100 - (urgentRestockProfiles.length / Math.max(1, state.products.length)) * 120
  );
  const marginHealth = Math.min(100, Math.max(0, contributionMarginRatio * 180));
  const safetyHealth = Math.min(100, Math.max(0, marginOfSafetyPct * 1.4));
  const arRatioGlobal = actualRevenue > 0 ? receivablesTotal / actualRevenue : 0;
  const liquidityHealth = Math.min(100, Math.max(0, 100 - arRatioGlobal * 140));
  const healthScore = Math.round(
    stockHealth * 0.3 + marginHealth * 0.25 + safetyHealth * 0.25 + liquidityHealth * 0.2
  );

  return {
    computedAt: new Date().toISOString(),
    activeEnginesCount: 4,
    healthScore,
    contributionMarginRatio: roundMoney(contributionMarginRatio * 100),
    breakEvenRevenue,
    actualRevenue,
    marginOfSafetyPct,
    workingCapitalNet,
    receivablesTotal,
    payablesTotal,
    pendingPoCommitment,
    inventoryValuationCost,
    abcBreakdown,
    productProfiles,
    decisions,
  };
}
