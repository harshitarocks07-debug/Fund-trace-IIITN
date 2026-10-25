const data = [
  { month: "May", donations: 42, expenses: 22 },
  { month: "Jun", donations: 58, expenses: 35 },
  { month: "Jul", donations: 49, expenses: 30 },
  { month: "Aug", donations: 72, expenses: 42 },
  { month: "Sep", donations: 64, expenses: 48 },
  { month: "Oct", donations: 86, expenses: 57 },
];

export function DonationChart() {
  const max = Math.max(...data.map((item) => item.donations));
  return (
    <section className="panel chart-panel">
      <div className="panel-heading">
        <div><p className="eyebrow">FUND MOVEMENT</p><h2>Donations &amp; expenses</h2></div>
        <button className="select-button">Last 6 months <span>⌄</span></button>
      </div>
      <div className="chart-legend"><span><i className="legend-donation" /> Donations</span><span><i className="legend-expense" /> Expenses</span><b>₹ in thousands</b></div>
      <div className="chart-area" role="img" aria-label="Bar chart comparing monthly donations and expenses from May to October">
        <div className="chart-guides"><span>100</span><span>75</span><span>50</span><span>25</span><span>0</span></div>
        <div className="chart-bars">
          {data.map((item) => (
            <div className="chart-month" key={item.month}>
              <div className="bar-pair">
                <div className="bar bar-donation" style={{ height: `${item.donations / max * 100}%` }} title={`${item.month} donations: ₹${item.donations}k`} />
                <div className="bar bar-expense" style={{ height: `${item.expenses / max * 100}%` }} title={`${item.month} expenses: ₹${item.expenses}k`} />
              </div>
              <span>{item.month}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}