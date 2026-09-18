const { callGemini } = require('./gemini');

async function handleChatQuery(req, res) {
  const {
    userId,
    query,
    period = 'THIS_MONTH',
    financialData
  } = req.body;

  if (!query || query.trim().length === 0) {
    return res.status(400).json({ error: 'query is required' });
  }

  const summary = financialData?.summary || {};
  const categories = financialData?.categoryBreakdown || [];
  const topMerchants = financialData?.topMerchants || [];
  const budgets = financialData?.budgets || [];
  const recurring = financialData?.recurringExpenses || [];
  const mom = financialData?.momComparison || {};
  const txCount = summary.transactionCount || 0;

  if (txCount === 0) {
    return res.json({
      reply: "I don't have any transaction data for this period yet. Please add or scan your bank/UPI transaction SMS so I can give you accurate answers.",
      period
    });
  }

  const systemInstruction = `You are SpendWise AI, an intelligent personal financial assistant for an Android app.
Answer the user's question using ONLY the ground-truth data provided below.
Rules:
1. Always format amounts in Indian Rupees (₹).
2. Never fabricate transactions, merchants, or balances. If data for a specific question does not exist in the facts, explicitly say that there is insufficient data.
3. Keep answers concise (2 to 4 sentences or bullet points), friendly, polite, and actionable.
4. Active Time Period: ${period}. Tailor your answer to this time scope.`;

  const prompt = `ACTIVE PERIOD: ${period}
USER QUESTION: "${query}"

VERIFIED USER FINANCIAL FACTS:
- Total Income: ₹${summary.totalIncome || 0}
- Total Expenses: ₹${summary.totalExpenses || 0}
- Net Savings: ₹${summary.netSavings || 0} (Savings Rate: ${summary.savingsRate || 0}%)
- Total Transactions: ${txCount}
- Highest Single Expense: ₹${summary.highestExpense || 0} at ${summary.highestExpenseMerchant || 'Unknown'}
- Daily Average Spend: ₹${summary.dailyAverageSpending || 0}

CATEGORY BREAKDOWN:
${categories.map(c => `- ${c.category}: ₹${c.amount} (${c.percentage}% of total, ${c.transactionCount} transactions)`).join('\n') || 'None'}

TOP MERCHANTS:
${topMerchants.map(m => `- ${m.merchant}: ₹${m.totalAmount} (${m.transactionCount} times)`).join('\n') || 'None'}

BUDGETS & ADHERENCE:
${budgets.map(b => `- ${b.category}: Target ₹${b.recommendedAmount}, Spent ₹${b.currentSpent} (${b.percentageUsed}% - ${b.status})`).join('\n') || 'None'}

DETECTED RECURRING EXPENSES:
${recurring.map(r => `- ${r.category} (${r.merchant}): ₹${r.amount}`).join('\n') || 'None detected yet'}

MONTH-OVER-MONTH COMPARISON:
- Current Month: ₹${mom.currentMonthTotal || 0}
- Previous Month: ₹${mom.previousMonthTotal || 0}
- Trend: ${mom.percentageChange || 0}% ${mom.isIncrease ? 'Increase' : 'Decrease'}
`;

  try {
    const reply = await callGemini(prompt, systemInstruction);
    res.json({
      reply,
      period
    });
  } catch (err) {
    console.error('Chat generation error:', err);
    res.status(500).json({
      error: 'Failed to answer query',
      message: err.message
    });
  }
}

module.exports = { handleChatQuery };
