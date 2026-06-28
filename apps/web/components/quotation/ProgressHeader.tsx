export function ProgressHeader({ currentStep, totalSteps }: { currentStep: number; totalSteps: number }) {
  return (
    <div className="progress-header">
      <div className="progress-text">
        Step {currentStep + 1} of {totalSteps}
      </div>
      <div className="progress-bar-line">
        {Array.from({ length: totalSteps }).map((_, index) => (
          <span className={`progress-dot ${index <= currentStep ? "active" : ""}`} key={index} />
        ))}
      </div>
    </div>
  );
}
