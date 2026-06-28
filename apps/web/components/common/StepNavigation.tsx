import { Button } from "./Button";

type StepNavigationProps = {
  onBack?: () => void;
  onNext?: () => void;
  nextLabel?: string;
  backLabel?: string;
  canGoBack?: boolean;
};

export function StepNavigation({
  onBack,
  onNext,
  nextLabel = "CONTINUE",
  backLabel = "BACK",
  canGoBack = true
}: StepNavigationProps) {
  return (
    <div className="hc-nav-row">
      {canGoBack ? (
        <Button type="button" variant="secondary" onClick={onBack}>
          {backLabel}
        </Button>
      ) : null}
      {onNext ? (
        <Button type="button" onClick={onNext}>
          {nextLabel}
        </Button>
      ) : null}
    </div>
  );
}
