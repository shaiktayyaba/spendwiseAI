const { callGemini } = require('./gemini');

async function handleGenerateInsights(req, res) {
  const {
    userId,
    month,
    financialSummary,
    categoryBreakdown,
    momComparison,
    topMerchants,
    budgets
  } = req.body;

  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  const totalExpense = financialSummary?.totalExpenses || 0;
  const totalIncome = financialSummary?.totalIncome || 0;
  const txCount = financialSummary?.transactionCount || 0;

  if (txCount === 0 || totalExpense === 0) {
    return res.json({
      insightId: `insight_${userId}_${month || 'current'}`,
      userId,
      month: month || '',
      summary: 'Insufficient transaction history to generate AI monthly insights. Real bank or UPI transactions are required.',
      topCategory: 'None',
      topCategoryAmount: 0,
      spendingTrend: 'Establishing spending baseline.',
      predictedSpending: 0,
      potentialSavings: 0,
      recommendations: [
        'Add or scan SMS transactions to enable Gemini personalized financial intelligence.'
      ],
      savingOpportunities: [],
      createdAt: Date.now()
    });
  }

  const systemInstruction = `You are SpendWise AI, an expert, objective financial intelligence engine.
Analyze the user's real financial aggregates. Output STRICT JSON ONLY matching this schema:
{
  "summary": "Concise 2-sentence summary of the month's overall financial health and primary spending focus.",
  "topCategory": "Name of highest spend category",
  "topCategoryAmount": number,
  "spendingTrend": "Comparison statement with previous month (increase/decrease percentage).",
  "predictedSpending": number,
  "potentialSavings": number,
  "recommendations": ["Recommendation 1", "Recommendation 2", "Recommendation 3"],
  "savingOpportunities": ["Opportunity 1", "Opportunity 2"]
}
Rules:
1. Always use INR (₹) values.
2. Ground all numbers strictly in the provided ground-truth data. Do not hallucinate transactions.
3. No markdown code blocks, just raw JSON string.`;

  const prompt = `MONTH: ${month || 'Current Month'}
FINANCIAL FACTS (GROUND TRUTH):
- Total Income: ₹${totalIncome}
- Total Expenses: ₹${totalExpense}
- Net Savings: ₹${financialSummary?.netSavings || 0} (Rate: ${financialSummary?.savingsRate || 0}%)
- Total Transactions: ${txCount}
- Daily Average: ₹${financialSummary?.dailyAverageSpending || 0}
- Largest Expense: ₹${financialSummary?.highestExpense || 0} at ${financialSummary?.highestExpenseMerchant || 'Unknown'}

CATEGORY BREAKDOWN:
${(categoryBreakdown || []).map(c => `- ${c.category}: ₹${c.amount} (${c.percentage}%)`).join('\n')}

MONTH-OVER-MONTH:
- Previous Month Total: ₹${momComparison?.previousMonthTotal || 0}
- Current Month Total: ₹${momComparison?.currentMonthTotal || 0}
- Change: ${momComparison?.percentageChange || 0}% (${momComparison?.isIncrease ? 'Increase' : 'Decrease'})

TOP MERCHANTS:
${(topMerchants || []).map(m => `- ${m.merchant}: ₹${m.totalAmount}`).join('\n')}

BUDGET ADHERENCE:
${(budgets || []).map(b => `- ${b.category}: Target ₹${b.recommendedAmount}, Spent ₹${b.currentSpent} (${b.percentageUsed}% - ${b.status})`).join('\n')}
`;

  try {
    const rawResponse = await callGemini(prompt, systemInstruction);
    const cleaned = rawResponse.replace(/\`\`\`json/g, '').replace(/\`\`\`/g, '').trim();
    const parsed = JSON.parse(cleaned);

    const insight = {
      insightId: `insight_${userId}_${month || 'current'}`,
      userId,
      month: month || '',
      summary: parsed.summary || 'Monthly financial analysis completed.',
      topCategory: parsed.topCategory || categoryBreakdown?.[0]?.category || 'General',
      topCategoryAmount: Number(parsed.topCategoryAmount) || categoryBreakdown?.[0]?.amount || 0,
      spendingTrend: parsed.spendingTrend || 'Consistent spending pattern.',
      predictedSpending: Number(parsed.predictedSpending) || Math.round(totalExpense * 1.03),
      potentialSavings: Number(parsed.potentialSavings) || Math.round(totalExpense * 0.12),
      recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
      savingOpportunities: Array.isArray(parsed.savingOpportunities) ? parsed.savingOpportunities : [],
      createdAt: Date.now()
    };

    res.json(insight);
  } catch (err) {
    console.error('Insights generation error:', err);
    res.status(500).json({
      error: 'Failed to generate insights',
      message: err.message
    });
  }
}

module.exports = { handleGenerateInsights };
