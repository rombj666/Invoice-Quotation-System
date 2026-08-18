export function ProgressHeader({ currentStep, totalSteps, steps = [] }: { currentStep: number; totalSteps: number; steps?: string[] }) {
  return (
    <div className="progress-header">
      <div className="progress-heading-row">
        <div className="progress-text">Step {currentStep + 1} of {totalSteps}</div>
        {steps[currentStep] ? <strong>{steps[currentStep]}</strong> : null}
      </div>
      <div className="progress-bar-line">
        {Array.from({ length: totalSteps }).map((_, index) => (
          <span className={`progress-segment ${index <= currentStep ? "active" : ""}`} key={index}>
            {steps[index] ? <small>{steps[index]}</small> : null}
          </span>
        ))}
      </div>
    </div>
  );
}
