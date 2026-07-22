export const SkeletonCard = () => (
  <div className="glass-card skeleton-card">
    <div className="skeleton-line skeleton-title"></div>
    <div className="skeleton-line skeleton-value"></div>
    <div className="skeleton-line skeleton-sub"></div>
  </div>
);

export const SkeletonChart = () => (
  <div className="glass-card skeleton-chart-container">
    <div className="skeleton-line skeleton-header"></div>
    <div className="skeleton-box skeleton-chart"></div>
  </div>
);

export const SkeletonTable = () => (
  <div className="glass-card skeleton-table-container">
    <div className="skeleton-line skeleton-header"></div>
    <div className="skeleton-rows">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="skeleton-row">
          <div className="skeleton-cell sm"></div>
          <div className="skeleton-cell lg"></div>
          <div className="skeleton-cell md"></div>
          <div className="skeleton-cell sm"></div>
        </div>
      ))}
    </div>
  </div>
);

export default SkeletonCard;
