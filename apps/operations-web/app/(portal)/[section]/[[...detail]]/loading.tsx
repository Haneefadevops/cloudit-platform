export default function SectionLoading() {
  return <div className="page-wrap" aria-busy="true" aria-label="Loading operations data">
    <div className="skeleton skeleton-header" />
    <div className="skeleton skeleton-line" />
    <div className="skeleton-grid">
      <div className="skeleton skeleton-card" />
      <div className="skeleton skeleton-card" />
    </div>
    <div className="skeleton skeleton-table" />
  </div>;
}
