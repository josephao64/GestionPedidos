import fs from "node:fs/promises";
import path from "node:path";
import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const workDir = "C:/Users/Elizabeth/Desktop/GestionPedidos/outputs/financial_dashboard_20260717";
const qaDir = path.join(workDir, "qa");
const outputPath = path.join(workDir, "Analisis_Financiero_Empresa.xlsx");
const referencePath = "C:/Users/Elizabeth/.codex/plugins/cache/openai-curated-remote/openai-templates/0.1.0/skills/artifact-template-analytics-dashboard/assets/reference.xlsx";
const repositoryRoot = "C:/Users/Elizabeth/Desktop/GestionPedidos";
const totalsSource = `${repositoryRoot}/SistemaFinanzas2-main/frontend/src/hooks/useRegistrarCierreTotals.js`;
const kpiSource = `${repositoryRoot}/SistemaFinanzas2-main/frontend/src/utils/kpi.js`;
const financeSource = `${repositoryRoot}/SistemaFinanzas2-main/frontend/src/components/finanzas/Finanzas.js`;

const CURRENCY = '"Q" #,##0;[Red]("Q" #,##0);-';
const PERCENT = "0.0%;[Red](0.0%);-";
const COUNT = "#,##0;[Red](#,##0);-";
const dark = "#0D1B2A";
const navy = "#19324A";
const blue = "#244A6B";
const headerBlue = "#223B53";
const cyan = "#39C6F0";
const lightBorder = "#D9E0E6";
const yellow = "#FFF2CC";
const yellowBorder = "#D6C26E";
const bodyText = "#17212B";
const linkedGreen = "#008000";

await fs.mkdir(qaDir, { recursive: true });
const workbook = await SpreadsheetFile.importXlsx(await FileBlob.load(referencePath));
const dashboard = workbook.worksheets.getItem("Dashboard");
const data = workbook.worksheets.getItem("Data & Targets");
const helpers = workbook.worksheets.getItem("_Chart Helpers");

// Workbook metadata and input sheet.
dashboard.getRange("B2").values = [["Financial Performance Dashboard"]];
dashboard.getRange("B3").values = [["Executive view — monthly actuals, targets, cash controls and payment mix"]];
dashboard.getRange("B4").formulas = [["=\"Status: \"&'Data & Targets'!$C$11"]];
dashboard.getRange("J2").values = [["SELECTED REPORTING PERIOD"]];
dashboard.getRange("N2").values = [["DATA CURRENT THROUGH"]];
dashboard.getRange("J3").formulas = [["='Data & Targets'!$C$9"]];
dashboard.getRange("N3").formulas = [["=IF('Data & Targets'!$C$10=\"\",\"Not loaded\",'Data & Targets'!$C$10)"]];

data.getRange("B2").values = [["Financial Performance Dashboard"]];
data.getRange("B3").values = [["Monthly Financial Inputs"]];
data.getRange("B5").values = [["HOW TO USE"]];
data.getRange("B6").values = [["Paste monthly GTQ totals from the authenticated Firebase cierres and pagos exports into yellow cells. Dates must remain real month-start dates."]];
data.getRange("B7").values = [["Blue text on yellow fill is editable. White calculation columns and all dashboard outputs are formula-driven."]];
data.getRange("B9").values = [["Selected Period"]];
data.getRange("C9").values = [[new Date(2026, 5, 1)]];
data.getRange("B10").values = [["Data Current Through"]];
data.getRange("C10").formulas = [["=IF(COUNT($C$16:$C$27)=0,\"\",MAX($B$16:$B$27))"]];
data.getRange("B11").values = [["Data Status"]];
data.getRange("C11:P11").clear({ applyTo: "contents" });
data.getRange("C11").formulas = [["=IF(COUNT($C$16:$C$27)=0,\"No actual financial data loaded — authenticated export required\",COUNT($C$16:$C$27)&\" of 12 months loaded\")"]];
data.getRange("C9:C10").format.numberFormat = "mmm yyyy";
data.getRange("C11:P11").format.wrapText = true;
data.getRange("C9").format = {
  fill: yellow,
  font: { color: "#0000FF" },
  borders: { preset: "all", style: "thin", color: yellowBorder },
  numberFormat: "mmm yyyy",
};

data.unmergeCells("B13:P13");
data.getRange("B13:T13").clear({ applyTo: "contents" });
data.mergeCells("B13:T13");
data.getRange("B13").values = [["MONTHLY FINANCIAL ACTUALS & TARGETS — EDIT YELLOW CELLS"]];
data.getRange("B13:T13").format = {
  fill: blue,
  font: { bold: true, color: "#FFFFFF", fontSize: 10 },
  horizontalAlignment: "left",
};

const monthlyHeaders = [[
  "Period", "System Sales", "Operating Expenses", "Net Operating Cash", "Expense Rate",
  "Available Deposits", "Deposit Conversion", "Cash Variance", "Sales Target", "Expense Budget",
  "Net Cash Target", "Expense Rate Target", "Deposit Target", "Deposit Conversion Target",
  "Cash Variance Tolerance", "Cash Sales", "Card Sales", "Delivery Sales", "Payment Mix Check",
]];
data.getRange("B15:T15").values = monthlyHeaders;
data.getRange("B15:T15").format = {
  fill: navy,
  font: { bold: true, color: "#FFFFFF", fontSize: 8 },
  borders: { preset: "all", style: "thin", color: lightBorder },
  wrapText: true,
  horizontalAlignment: "center",
  verticalAlignment: "center",
};
data.getRange("B15:T15").format.rowHeight = 36;
data.getRange("B16:T27").clear({ applyTo: "contents" });
const monthRows = Array.from({ length: 12 }, (_, i) => [new Date(2026, i, 1)]);
data.getRange("B16:B27").values = monthRows;

// Derived monthly calculations.
data.getRange("E16").formulas = [["=IF(OR(C16=\"\",D16=\"\"),\"\",C16-D16)"]];
data.getRange("E16:E27").fillDown();
data.getRange("F16").formulas = [["=IFERROR(D16/C16,\"\")"]];
data.getRange("F16:F27").fillDown();
data.getRange("H16").formulas = [["=IFERROR(G16/C16,\"\")"]];
data.getRange("H16:H27").fillDown();
data.getRange("L16").formulas = [["=IF(OR(J16=\"\",K16=\"\"),\"\",J16-K16)"]];
data.getRange("L16:L27").fillDown();
data.getRange("M16").formulas = [["=IFERROR(K16/J16,\"\")"]];
data.getRange("M16:M27").fillDown();
data.getRange("O16").formulas = [["=IFERROR(N16/J16,\"\")"]];
data.getRange("O16:O27").fillDown();
data.getRange("T16").formulas = [["=IF(COUNT(Q16:S16)=0,\"\",SUM(Q16:S16)-C16)"]];
data.getRange("T16:T27").fillDown();

const inputRanges = ["B16:D27", "G16:G27", "I16:K27", "N16:N27", "P16:S27"];
for (const address of inputRanges) {
  data.getRange(address).format = {
    fill: yellow,
    font: { color: "#0000FF", fontSize: 9 },
    borders: { preset: "all", style: "thin", color: yellowBorder },
    horizontalAlignment: "right",
  };
}
const formulaRanges = ["E16:F27", "H16:H27", "L16:M27", "O16:O27", "T16:T27"];
for (const address of formulaRanges) {
  data.getRange(address).format = {
    fill: "#FFFFFF",
    font: { color: "#000000", fontSize: 9 },
    borders: { preset: "all", style: "thin", color: lightBorder },
    horizontalAlignment: "right",
  };
}
data.getRange("B16:B27").format.numberFormat = "mmm yyyy";
for (const address of ["C16:E27", "G16:G27", "I16:L27", "N16:N27", "P16:T27", "Q16:S27"]) {
  data.getRange(address).format.numberFormat = CURRENCY;
}
for (const address of ["F16:F27", "H16:H27", "M16:M27", "O16:O27"]) {
  data.getRange(address).format.numberFormat = PERCENT;
}
data.getRange("B15:T27").format.verticalAlignment = "center";
data.getRange("B16:T27").format.rowHeight = 20;
data.getRange("B1:B35").format.columnWidth = 14;
data.getRange("C1:T35").format.columnWidth = 18;
data.getRange("E1:E35").format.columnWidth = 20;
data.getRange("F1:F35").format.columnWidth = 15;
data.getRange("H1:H35").format.columnWidth = 18;
data.getRange("I1:I35").format.columnWidth = 16;
data.getRange("L1:L35").format.columnWidth = 18;
data.getRange("M1:M35").format.columnWidth = 18;
data.getRange("O1:O35").format.columnWidth = 21;
data.getRange("P1:P35").format.columnWidth = 22;
data.getRange("T1:T35").format.columnWidth = 19;
data.freezePanes.freezeRows(15);

// Selected-period bridge and payment-mix diagnostics.
data.getRange("B29:J35").clear({ applyTo: "contents" });
data.getRange("B29").values = [["SELECTED PERIOD CASH FLOW BRIDGE"]];
data.getRange("G29").values = [["SELECTED PERIOD PAYMENT MIX"]];
data.getRange("B30:C30").values = [["Line Item", "Amount"]];
data.getRange("G30:H30").values = [["Payment Method", "Amount / Status"]];
data.getRange("B31:B35").values = [["System Sales"], ["Operating Expenses"], ["Net Operating Cash"], ["Available Deposits"], ["Cash Variance"]];
data.getRange("C31:C35").formulas = [
  ["='_Chart Helpers'!$B$2"],
  ["=-'_Chart Helpers'!$B$3"],
  ["='_Chart Helpers'!$B$4"],
  ["='_Chart Helpers'!$B$6"],
  ["='_Chart Helpers'!$B$8"],
];
data.getRange("G31:G35").values = [["Cash"], ["Card"], ["Delivery"], ["Payment Mix Check"], ["Payment Mix Status"]];
const selectedRow = "MATCH($C$9,$B$16:$B$27,0)";
data.getRange("H31:H35").formulas = [
  [`=IF(INDEX($Q$16:$Q$27,${selectedRow})=\"\",\"\",INDEX($Q$16:$Q$27,${selectedRow}))`],
  [`=IF(INDEX($R$16:$R$27,${selectedRow})=\"\",\"\",INDEX($R$16:$R$27,${selectedRow}))`],
  [`=IF(INDEX($S$16:$S$27,${selectedRow})=\"\",\"\",INDEX($S$16:$S$27,${selectedRow}))`],
  [`=IF(INDEX($T$16:$T$27,${selectedRow})=\"\",\"\",INDEX($T$16:$T$27,${selectedRow}))`],
  ["=IF(COUNT(H31:H33)=0,\"NO DATA\",IF(ABS(H34)<=0.01,\"PASS\",\"CHECK\"))"],
];
data.getRange("B29:E29").format = { fill: blue, font: { bold: true, color: "#FFFFFF", fontSize: 9 } };
data.getRange("G29:J29").format = { fill: blue, font: { bold: true, color: "#FFFFFF", fontSize: 9 } };
for (const address of ["B30:C30", "G30:H30"]) {
  data.getRange(address).format = {
    fill: "#25313C",
    font: { bold: true, color: "#FFFFFF", fontSize: 9 },
    borders: { preset: "all", style: "thin", color: lightBorder },
    horizontalAlignment: "center",
  };
}
for (const address of ["B31:B35", "G31:G35"]) {
  data.getRange(address).format = {
    fill: "#FFFFFF",
    font: { color: bodyText, fontSize: 9 },
    borders: { preset: "all", style: "thin", color: lightBorder },
  };
}
for (const address of ["C31:C35", "H31:H34"]) {
  data.getRange(address).format = {
    fill: "#FFFFFF",
    font: { color: linkedGreen, fontSize: 9 },
    borders: { preset: "all", style: "thin", color: lightBorder },
    horizontalAlignment: "right",
    numberFormat: CURRENCY,
  };
}
data.getRange("H35").format = {
  fill: "#FFF2CC",
  font: { bold: true, color: "#7F6000", fontSize: 9 },
  borders: { preset: "all", style: "thin", color: yellowBorder },
  horizontalAlignment: "center",
};
data.getRange("H35").conditionalFormats.deleteAll();
data.getRange("H35").conditionalFormats.add("containsText", { text: "PASS", format: { fill: "#E2F0D9", font: { color: "#2E7D32", bold: true } } });
data.getRange("H35").conditionalFormats.add("containsText", { text: "CHECK", format: { fill: "#FCE8E6", font: { color: "#C62828", bold: true } } });

// Central helper logic for KPIs, trends and charts.
helpers.getRange("A1:T13").clear({ applyTo: "contents" });
helpers.getRange("A1:F1").values = [["Metric", "Actual", "Target / Tolerance", "Prior", "Direction", "Status"]];
helpers.getRange("A2:A9").values = [
  ["System Sales"], ["Operating Expenses"], ["Net Operating Cash"], ["Expense Rate"],
  ["Available Deposits"], ["Deposit Conversion"], ["Cash Variance"], ["Net Cash Margin"],
];
helpers.getRange("E2:E9").values = [["Higher"], ["Lower"], ["Higher"], ["Lower"], ["Higher"], ["Higher"], ["Within"], ["Higher"]];

const selectedFormula = (col) => {
  const idx = `MATCH('Data & Targets'!$C$9,'Data & Targets'!$B$16:$B$27,0)`;
  const lookup = `INDEX('Data & Targets'!$${col}$16:$${col}$27,${idx})`;
  return `=IF(${lookup}=\"\",\"\",${lookup})`;
};
const priorFormula = (col) => {
  const idx = `MATCH('Data & Targets'!$C$9,'Data & Targets'!$B$16:$B$27,0)`;
  const lookup = `INDEX('Data & Targets'!$${col}$16:$${col}$27,${idx}-1)`;
  return `=IF(${idx}<=1,\"\",IF(${lookup}=\"\",\"\",${lookup}))`;
};
const actualCols = ["C", "D", "E", "F", "G", "H", "I"];
const targetCols = ["J", "K", "L", "M", "N", "O", "P"];
for (let i = 0; i < 7; i += 1) {
  const row = i + 2;
  helpers.getRange(`B${row}`).formulas = [[selectedFormula(actualCols[i])]];
  helpers.getRange(`C${row}`).formulas = [[selectedFormula(targetCols[i])]];
  helpers.getRange(`D${row}`).formulas = [[priorFormula(actualCols[i])]];
  helpers.getRange(`F${row}`).formulas = [[
    `=IF(OR(B${row}=\"\",C${row}=\"\"),\"Needs Data\",IF(E${row}=\"Within\",IF(ABS(B${row})<=C${row},\"Favorable\",IF(ABS(B${row})<=C${row}*1.05,\"Watch\",\"Unfavorable\")),IF(E${row}=\"Higher\",IF(B${row}>=C${row},\"Favorable\",IF(B${row}>=C${row}*0.95,\"Watch\",\"Unfavorable\")),IF(B${row}<=C${row},\"Favorable\",IF(B${row}<=C${row}*1.05,\"Watch\",\"Unfavorable\")))))`,
  ]];
}
helpers.getRange("B9").formulas = [["=IF(B2=\"\",\"\",IFERROR(B4/B2,\"\"))"]];
helpers.getRange("C9").formulas = [["=IF(C2=\"\",\"\",IFERROR(C4/C2,\"\"))"]];
helpers.getRange("D9").formulas = [["=IF(D2=\"\",\"\",IFERROR(D4/D2,\"\"))"]];
helpers.getRange("F9").formulas = [["=IF(OR(B9=\"\",C9=\"\"),\"Needs Data\",IF(B9>=C9,\"Favorable\",IF(B9>=C9*0.95,\"Watch\",\"Unfavorable\")))"]];

helpers.getRange("H1:J1").values = [["Period", "System Sales", "Target"]];
helpers.getRange("L1:N1").values = [["Period", "Operating Expenses", "Budget"]];
for (let i = 0; i < 12; i += 1) {
  const sourceRow = i + 16;
  const helperRow = i + 2;
  helpers.getRange(`H${helperRow}:J${helperRow}`).formulas = [[
    `=TEXT('Data & Targets'!B${sourceRow},\"mmm yyyy\")`,
    `=IF(COUNT('Data & Targets'!$C$16:$C$27)=0,0,IF('Data & Targets'!C${sourceRow}=\"\",\"\",'Data & Targets'!C${sourceRow}))`,
    `=IF(COUNT('Data & Targets'!$C$16:$C$27)=0,0,IF('Data & Targets'!J${sourceRow}=\"\",\"\",'Data & Targets'!J${sourceRow}))`,
  ]];
  helpers.getRange(`L${helperRow}:N${helperRow}`).formulas = [[
    `=TEXT('Data & Targets'!B${sourceRow},\"mmm yyyy\")`,
    `=IF(COUNT('Data & Targets'!$D$16:$D$27)=0,0,IF('Data & Targets'!D${sourceRow}=\"\",\"\",'Data & Targets'!D${sourceRow}))`,
    `=IF(COUNT('Data & Targets'!$D$16:$D$27)=0,0,IF('Data & Targets'!K${sourceRow}=\"\",\"\",'Data & Targets'!K${sourceRow}))`,
  ]];
}

helpers.getRange("P1:Q1").values = [["Stage", "Amount"]];
helpers.getRange("P2:P6").formulas = [
  ["=IF(COUNT('Data & Targets'!$C$16:$C$27)=0,\"No data loaded\",\"System Sales\")"],
  ["=\"Operating Expenses\""], ["=\"Net Operating Cash\""], ["=\"Available Deposits\""], ["=\"Cash Variance\""],
];
helpers.getRange("Q2:Q6").formulas = [
  ["=IF(COUNT('Data & Targets'!$C$16:$C$27)=0,1,IF($B$2=\"\",0,$B$2))"],
  ["=IF(COUNT('Data & Targets'!$C$16:$C$27)=0,0,-ABS(IF($B$3=\"\",0,$B$3)))"],
  ["=IF(COUNT('Data & Targets'!$C$16:$C$27)=0,0,IF($B$4=\"\",0,$B$4))"],
  ["=IF(COUNT('Data & Targets'!$C$16:$C$27)=0,0,IF($B$6=\"\",0,$B$6))"],
  ["=IF(COUNT('Data & Targets'!$C$16:$C$27)=0,0,IF($B$8=\"\",0,$B$8))"],
];

const matchSelected = `MATCH('Data & Targets'!$C$9,'Data & Targets'!$B$16:$B$27,0)`;
const channelLookup = (col) => `INDEX('Data & Targets'!$${col}$16:$${col}$27,${matchSelected})`;
const cashLookup = channelLookup("Q");
const cardLookup = channelLookup("R");
const deliveryLookup = channelLookup("S");
const channelCount = `COUNT(${cashLookup},${cardLookup},${deliveryLookup})`;
helpers.getRange("S1:T1").values = [["Payment Method", "Sales"]];
helpers.getRange("S2:S4").formulas = [[`=IF(${channelCount}=0,\"No data loaded\",\"Cash\")`], ["=\"Card\""], ["=\"Delivery\""]];
helpers.getRange("T2:T4").formulas = [
  [`=IF(${channelCount}=0,1,IF(${cashLookup}=\"\",0,${cashLookup}))`],
  [`=IF(${channelCount}=0,0,IF(${cardLookup}=\"\",0,${cardLookup}))`],
  [`=IF(${channelCount}=0,0,IF(${deliveryLookup}=\"\",0,${deliveryLookup}))`],
];
helpers.getRange("B2:D8").format.numberFormat = CURRENCY;
helpers.getRange("B4:D4").format.numberFormat = CURRENCY;
helpers.getRange("B5:D5").format.numberFormat = PERCENT;
helpers.getRange("B7:D7").format.numberFormat = PERCENT;
helpers.getRange("B9:D9").format.numberFormat = PERCENT;
helpers.getRange("I2:J13").format.numberFormat = CURRENCY;
helpers.getRange("M2:N13").format.numberFormat = CURRENCY;
helpers.getRange("Q2:Q6").format.numberFormat = CURRENCY;
helpers.getRange("T2:T4").format.numberFormat = CURRENCY;

// Dashboard KPI cards and variance table.
dashboard.getRange("B5:Q13").clear({ applyTo: "contents" });
dashboard.getRange("B5").values = [["SYSTEM SALES"]];
dashboard.getRange("F5").values = [["OPERATING EXPENSES"]];
dashboard.getRange("J5").values = [["NET OPERATING CASH"]];
dashboard.getRange("N5").values = [["EXPENSE RATE"]];
dashboard.getRange("B10").values = [["AVAILABLE DEPOSITS"]];
dashboard.getRange("F10").values = [["DEPOSIT CONVERSION"]];
dashboard.getRange("J10").values = [["CASH VARIANCE"]];
dashboard.getRange("N10").values = [["NET CASH MARGIN"]];
dashboard.getRange("C8:Q8").values = [[
  "vs prior", null, "vs target", null, "vs prior", null, "vs target", null, "vs prior", null, "vs target", null, "vs prior", null, "vs target",
]];
dashboard.getRange("C13:Q13").values = [[
  "vs prior", null, "vs target", null, "vs prior", null, "vs target", null, "vs prior", null, "vs target", null, "vs prior", null, "vs target",
]];
const cardValueCells = ["B6", "F6", "J6", "N6", "B11", "F11", "J11", "N11"];
for (let i = 0; i < cardValueCells.length; i += 1) {
  dashboard.getRange(cardValueCells[i]).formulas = [[`='_Chart Helpers'!$B$${i + 2}`]];
}
for (const address of ["B6", "F6", "J6", "B11", "J11"]) dashboard.getRange(address).format.numberFormat = CURRENCY;
for (const address of ["N6", "F11", "N11"]) dashboard.getRange(address).format.numberFormat = PERCENT;

const priorCells = ["B8", "F8", "J8", "N8", "B13", "F13", "J13", "N13"];
const targetCells = ["D8", "H8", "L8", "P8", "D13", "H13", "L13", "P13"];
for (let i = 0; i < priorCells.length; i += 1) {
  const helperRow = i + 2;
  dashboard.getRange(priorCells[i]).formulas = [[`=IF('_Chart Helpers'!$D$${helperRow}=\"\",\"\",IFERROR('_Chart Helpers'!$B$${helperRow}/'_Chart Helpers'!$D$${helperRow}-1,\"\"))`]];
  dashboard.getRange(targetCells[i]).formulas = [[`=IFERROR('_Chart Helpers'!$B$${helperRow}/'_Chart Helpers'!$C$${helperRow}-1,\"\")`]];
  dashboard.getRange(priorCells[i]).format.numberFormat = PERCENT;
  dashboard.getRange(targetCells[i]).format.numberFormat = PERCENT;
}
dashboard.getRange("J13").formulas = [["=IF(OR('_Chart Helpers'!$D$8=\"\",'_Chart Helpers'!$D$8=0),\"\",ABS('_Chart Helpers'!$B$8)/ABS('_Chart Helpers'!$D$8)-1)"]];
dashboard.getRange("L13").formulas = [["=IF(OR('_Chart Helpers'!$C$8=\"\",'_Chart Helpers'!$C$8=0),\"\",ABS('_Chart Helpers'!$B$8)/'_Chart Helpers'!$C$8-1)"]];

dashboard.getRange("B15:Q15").clear({ applyTo: "contents" });
dashboard.getRange("B15").values = [["SYSTEM SALES — ACTUAL VS TARGET"]];
dashboard.getRange("J15").values = [["OPERATING EXPENSES — ACTUAL VS BUDGET"]];
dashboard.getRange("B29:Q29").clear({ applyTo: "contents" });
dashboard.getRange("B29").values = [["SELECTED-PERIOD CASH FLOW BRIDGE"]];
dashboard.getRange("J29").values = [["SELECTED-PERIOD SALES MIX BY CHANNEL"]];
dashboard.getRange("B43:Q52").clear({ applyTo: "contents" });
dashboard.getRange("B43").values = [["SELECTED-PERIOD FINANCIAL VARIANCE"]];
dashboard.getRange("B44:H44").values = [["Metric", "Goal", "Actual", "Target / Tolerance", "Variance", "Variance %", "Status"]];
for (let i = 0; i < 8; i += 1) {
  const dashboardRow = i + 45;
  const helperRow = i + 2;
  dashboard.getRange(`B${dashboardRow}:E${dashboardRow}`).formulas = [[
    `='_Chart Helpers'!$A$${helperRow}`,
    `='_Chart Helpers'!$E$${helperRow}`,
    `='_Chart Helpers'!$B$${helperRow}`,
    `='_Chart Helpers'!$C$${helperRow}`,
  ]];
  dashboard.getRange(`F${dashboardRow}`).formulas = [[`=IF(OR(D${dashboardRow}=\"\",E${dashboardRow}=\"\"),\"\",IF(C${dashboardRow}=\"Within\",ABS(D${dashboardRow})-E${dashboardRow},D${dashboardRow}-E${dashboardRow}))`]];
  dashboard.getRange(`G${dashboardRow}`).formulas = [[`=IF(OR(D${dashboardRow}=\"\",E${dashboardRow}=\"\"),\"\",IF(C${dashboardRow}=\"Within\",IF(E${dashboardRow}=0,\"\",ABS(D${dashboardRow})/E${dashboardRow}-1),IFERROR(D${dashboardRow}/E${dashboardRow}-1,\"\")))`]];
  dashboard.getRange(`H${dashboardRow}`).formulas = [[`='_Chart Helpers'!$F$${helperRow}`]];
}
for (const row of [45, 46, 47, 49, 51]) dashboard.getRange(`D${row}:F${row}`).format.numberFormat = CURRENCY;
for (const row of [48, 50, 52]) dashboard.getRange(`D${row}:F${row}`).format.numberFormat = PERCENT;
dashboard.getRange("G45:G52").format.numberFormat = PERCENT;
dashboard.getRange("J45").values = [["Status is direction-aware: sales, net cash, deposits and margins favor higher results; expenses favor lower results; cash variance must remain within tolerance."]];
dashboard.getRange("J50").values = [["No company actuals are embedded. The dashboard remains in Needs Data status until authenticated monthly exports are pasted into yellow cells."]];

// Update retained native charts without replacing the template's visual system.
const chartItems = dashboard.charts.items;
if (chartItems.length >= 4) {
  chartItems[0].setData(helpers.getRange("H1:J13"));
  chartItems[1].setData(helpers.getRange("L1:N13"));
  chartItems[2].setData(helpers.getRange("P1:Q6"));
  chartItems[3].setData(helpers.getRange("S1:T4"));
  chartItems[0].title = "Monthly System Sales vs Target (GTQ)";
  chartItems[0].yAxis = { numberFormatCode: '"Q" #,##0', textStyle: { fontSize: 10 } };
  if (chartItems[0].series.items.length >= 2) {
    chartItems[0].series.items[0].fill = cyan;
    chartItems[0].series.items[1].fill = "#F4B000";
  }
  chartItems[1].title = "Operating Expenses vs Budget (GTQ)";
  chartItems[1].yAxis = { numberFormatCode: '"Q" #,##0', textStyle: { fontSize: 10 } };
  if (chartItems[1].series.items.length >= 2) {
    chartItems[1].series.items[0].fill = "#38C997";
    chartItems[1].series.items[1].fill = "#F27030";
  }
  chartItems[2].title = "Selected-period Cash Flow Bridge (GTQ)";
  chartItems[2].xAxis = { numberFormatCode: '"Q" #,##0', textStyle: { fontSize: 10 } };
  if (chartItems[2].series.items.length >= 1) chartItems[2].series.items[0].fill = cyan;
  chartItems[3].title = "Selected-period Sales Mix by Channel";
}

// Finance audit and source documentation sheet.
const checks = workbook.worksheets.add("Checks & Sources");
checks.showGridLines = false;
checks.mergeCells("A1:H1");
checks.mergeCells("A2:H2");
checks.mergeCells("A5:H5");
checks.mergeCells("A14:H14");
checks.mergeCells("A24:H24");
checks.getRange("A1").values = [["Financial Dashboard — Checks & Sources"]];
checks.getRange("A2").values = [["Audit trail for definitions, data readiness and monthly refresh controls"]];
checks.getRange("A1:H2").format = { fill: dark, font: { color: "#FFFFFF", bold: true }, wrapText: true };
checks.getRange("A1").format.font = { color: "#FFFFFF", bold: true, fontSize: 15 };
checks.getRange("A2").format.font = { color: "#D9E2EA", italic: true, fontSize: 10 };
checks.getRange("A3:H3").values = [["Version", "1.0", null, "Built", new Date(2026, 6, 17), null, "Currency", "GTQ"]];
checks.getRange("E3").format.numberFormat = "yyyy-mm-dd";
checks.getRange("A3:H3").format = { fill: "#F3F5F7", font: { color: bodyText, fontSize: 9 }, borders: { preset: "inside", style: "thin", color: lightBorder } };
checks.getRange("A5").values = [["MODEL STATUS & CONTROLS"]];
checks.getRange("A5:H5").format = { fill: blue, font: { color: "#FFFFFF", bold: true, fontSize: 10 } };
checks.getRange("A6:H6").values = [["Overall Status", null, null, null, null, null, "Interpretation", "PASS only when all required monthly inputs and controls pass."]];
checks.getRange("B6").formulas = [["=IF(COUNTIF(F8:F12,\"<>OK\")=0,\"PASS\",\"NEEDS INPUT\")"]];
checks.getRange("A7:H7").values = [["Check", "Actual", "Expected", "Difference", "Tolerance", "Status", "Where to Fix", "Notes"]];
checks.getRange("A7:H7").format = {
  fill: headerBlue,
  font: { color: "#FFFFFF", bold: true, fontSize: 9 },
  borders: { preset: "all", style: "thin", color: lightBorder },
  horizontalAlignment: "center",
  wrapText: true,
};
checks.getRange("A8:A12").values = [
  ["Actual months loaded"], ["Sales target months loaded"], ["Selected-period payment mix ties to sales"],
  ["Negative sales / expense inputs"], ["Selected period is in monthly table"],
];
checks.getRange("B8:B12").formulas = [
  ["=COUNT('Data & Targets'!$C$16:$C$27)"],
  ["=COUNT('Data & Targets'!$J$16:$J$27)"],
  ["=ABS(IF('_Chart Helpers'!$B$2=\"\",0,SUM('Data & Targets'!$H$31:$H$33)-'_Chart Helpers'!$B$2))"],
  ["=COUNTIF('Data & Targets'!$C$16:$D$27,\"<0\")"],
  ["=COUNTIF('Data & Targets'!$B$16:$B$27,'Data & Targets'!$C$9)"],
];
checks.getRange("C8:C12").values = [[12], [12], [0], [0], [1]];
checks.getRange("D8").formulas = [["=B8-C8"]];
checks.getRange("D8:D12").fillDown();
checks.getRange("E8:E12").values = [[0], [0], [0.01], [0], [0]];
checks.getRange("F8:F12").formulas = [
  ["=IF(B8=C8,\"OK\",\"ACTION REQUIRED\")"],
  ["=IF(B9=C9,\"OK\",\"ACTION REQUIRED\")"],
  ["=IF(COUNT('Data & Targets'!$H$31:$H$33)=0,\"ACTION REQUIRED\",IF(B10<=E10,\"OK\",\"CHECK\"))"],
  ["=IF(B11=C11,\"OK\",\"CHECK\")"],
  ["=IF(B12=C12,\"OK\",\"CHECK\")"],
];
checks.getRange("G8:G12").values = [
  ["Data & Targets!C16:C27"], ["Data & Targets!J16:J27"], ["Data & Targets!Q16:S27"],
  ["Data & Targets!C16:D27"], ["Data & Targets!C9"],
];
checks.getRange("H8:H12").values = [
  ["Load all 12 monthly System Sales values."], ["Load all 12 monthly Sales Targets for variance analysis."],
  ["Cash + Card + Delivery should equal System Sales for the selected month."],
  ["Sales and expense inputs should not be negative."], ["Selected reporting period must match one of the 12 month-start dates."],
];
checks.getRange("A6:H12").format.borders = { preset: "all", style: "thin", color: lightBorder };
checks.getRange("A6:H12").format.wrapText = true;
checks.getRange("B8:E12").format.numberFormat = COUNT;
checks.getRange("B10:E10").format.numberFormat = '"Q" #,##0.00;[Red]("Q" #,##0.00);-';
checks.getRange("B6").format = { fill: "#FFF2CC", font: { bold: true, color: "#7F6000" }, horizontalAlignment: "center" };
checks.getRange("B6").conditionalFormats.add("containsText", { text: "PASS", format: { fill: "#E2F0D9", font: { color: "#2E7D32", bold: true } } });
checks.getRange("B6").conditionalFormats.add("containsText", { text: "NEEDS INPUT", format: { fill: "#FFF2CC", font: { color: "#7F6000", bold: true } } });
checks.getRange("F8:F12").conditionalFormats.add("containsText", { text: "OK", format: { fill: "#E2F0D9", font: { color: "#2E7D32", bold: true } } });
checks.getRange("F8:F12").conditionalFormats.add("containsText", { text: "CHECK", format: { fill: "#FCE8E6", font: { color: "#C62828", bold: true } } });
checks.getRange("F8:F12").conditionalFormats.add("containsText", { text: "ACTION REQUIRED", format: { fill: "#FFF2CC", font: { color: "#7F6000", bold: true } } });

checks.getRange("A14").values = [["SOURCES & DEFINITIONS"]];
checks.getRange("A14:H14").format = { fill: blue, font: { color: "#FFFFFF", bold: true, fontSize: 10 } };
checks.getRange("A15:H15").values = [["Item", "Value / Definition", "Units", "Period / As-of", "Source Type", "Source / File", "Owner", "Notes"]];
checks.getRange("A15:H15").format = {
  fill: headerBlue,
  font: { color: "#FFFFFF", bold: true, fontSize: 9 },
  borders: { preset: "all", style: "thin", color: lightBorder },
  horizontalAlignment: "center",
  wrapText: true,
};
checks.getRange("A16:H22").values = [
  ["Currency", "Guatemalan quetzal", "GTQ", "Current app convention", "Local application", financeSource, "Finance team", "Confirmed by es-GT / GTQ currency formatter."],
  ["System Sales", "totalCierreEfectivo + totalCierreTarjeta + totalCierreMotorista", "GTQ", "Monthly", "Local application", totalsSource, "Finance team", "Aggregate authenticated cierres by month before pasting."],
  ["Operating Expenses", "Sum of gastos.cantidad and documented payment records", "GTQ", "Monthly", "Local application", totalsSource, "Finance team", "Use a consistent cutoff and exclude balance-sheet transfers if management reporting does so."],
  ["Available Deposits", "totalGeneral = net cash counted - expenses + petty cash used + shortage paid", "GTQ", "Monthly", "Local application", totalsSource, "Finance team", "Mirrors the application's current totalGeneral definition."],
  ["Cash Variance", "(net counted cash + counted card) - (system cash + system card)", "GTQ", "Monthly", "Local application", totalsSource, "Finance team", "Positive is surplus; negative is shortage. Compare absolute value with tolerance."],
  ["Deposit KPI", "Sum closures totalGeneral - non-adjustment payments + petty-cash adjustments", "GTQ", "As refreshed", "Local application", kpiSource, "Finance team", "Use when reconciling the branch-level deposit balance."],
  ["Actual company values", "Not embedded; Firebase read requires authenticated access", "N/A", "2026-07-17", "Data availability", "Firebase collections: cierres, pagos, sucursales", "Data owner", "Paste an authenticated monthly export into the yellow cells; do not treat blanks as zero actuals."],
];
checks.getRange("A16:H22").format = {
  fill: "#FFFFFF",
  font: { color: bodyText, fontSize: 9 },
  borders: { preset: "all", style: "thin", color: lightBorder },
  wrapText: true,
  verticalAlignment: "top",
};
checks.getRange("A24").values = [["Refresh sequence: export authenticated monthly cierres and pagos → aggregate the defined fields → paste yellow inputs → confirm Checks status → review Dashboard."]];
checks.getRange("A24:H24").format = { fill: "#EAF2F8", font: { italic: true, color: bodyText, fontSize: 9 }, wrapText: true };
checks.getRange("A1:A24").format.columnWidth = 28;
checks.getRange("B1:B24").format.columnWidth = 42;
checks.getRange("C1:E24").format.columnWidth = 16;
checks.getRange("F1:F24").format.columnWidth = 62;
checks.getRange("G1:G24").format.columnWidth = 28;
checks.getRange("H1:H24").format.columnWidth = 48;
checks.getRange("A1:H24").format.autofitRows();
checks.getRange("A1:H24").format.rowHeight = 22;
checks.getRange("A1:H2").format.rowHeight = 28;
checks.getRange("A16:H22").format.rowHeight = 48;
checks.getRange("A24:H24").format.rowHeight = 36;
checks.freezePanes.freezeRows(7);

// Source notes on editable input headers.
workbook.comments.setSelf({ displayName: "Elizabeth" });
workbook.comments.addThread({ cell: data.getRange("C15") }, `Source: authenticated monthly cierres export. Definition: system cash + card + delivery sales. Reference: ${totalsSource}`);
workbook.comments.addThread({ cell: data.getRange("D15") }, `Source: authenticated monthly gastos/pagos export. Reference: ${totalsSource}`);
workbook.comments.addThread({ cell: data.getRange("G15") }, `Source: totalGeneral / deposit KPI from authenticated closures. References: ${totalsSource}; ${kpiSource}`);
workbook.comments.addThread({ cell: data.getRange("I15") }, `Source: diferenciaReal from monthly closures. Reference: ${totalsSource}`);
workbook.comments.addThread({ cell: data.getRange("J15") }, "Assumption: management-approved monthly System Sales target; enter only an authorized target.");

// Compact verification before export.
const dashboardCheck = await workbook.inspect({
  kind: "table",
  range: "Dashboard!B2:Q52",
  include: "values,formulas",
  tableMaxRows: 18,
  tableMaxCols: 16,
  maxChars: 10000,
});
console.log("DASHBOARD_CHECK\n" + dashboardCheck.ndjson);
const inputCheck = await workbook.inspect({
  kind: "table",
  range: "Data & Targets!B9:T35",
  include: "values,formulas",
  tableMaxRows: 28,
  tableMaxCols: 19,
  maxChars: 12000,
});
console.log("INPUT_CHECK\n" + inputCheck.ndjson);
const checksCheck = await workbook.inspect({
  kind: "table",
  range: "Checks & Sources!A5:H22",
  include: "values,formulas",
  tableMaxRows: 20,
  tableMaxCols: 8,
  maxChars: 10000,
});
console.log("CHECKS_CHECK\n" + checksCheck.ndjson);
const errors = await workbook.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!",
  options: { useRegex: true, maxResults: 300 },
  summary: "final formula error scan",
  maxChars: 5000,
});
console.log("FORMULA_ERRORS\n" + errors.ndjson);

for (const sheet of workbook.worksheets.items) {
  const preview = await workbook.render({ sheetName: sheet.name, autoCrop: "all", scale: 1.25, format: "png" });
  const safeName = sheet.name.replace(/[^a-z0-9_-]+/gi, "_");
  await fs.writeFile(path.join(qaDir, `final_${safeName}.png`), new Uint8Array(await preview.arrayBuffer()));
}

const xlsx = await SpreadsheetFile.exportXlsx(workbook);
await xlsx.save(outputPath);
console.log(`EXPORTED\n${outputPath}`);
