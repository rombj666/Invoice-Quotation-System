import { Button } from "./Button";

type StepNavigationProps = {
  onBack?: () => void;
  onNext?: () => void;
  nextLabel?: string;
  backLabel?: string;
  canGoBack?: boolean;
  nextDisabled?: boolean;
};

export function StepNavigation({
  onBack,
  onNext,
  nextLabel = "CONTINUE",
  backLabel = "BACK",
  canGoBack = true,
  nextDisabled = false
}: StepNavigationProps) {
  return (
    <div className="hc-nav-row">
      {canGoBack ? (
        <Button type="button" variant="secondary" onClick={onBack}>
          {backLabel}
        </Button>
      ) : null}
      {onNext ? (
        <Button type="button" onClick={onNext} disabled={nextDisabled}>
          {nextLabel}
        </Button>
      ) : null}
    </div>
  );
}
