import type { GroupTemplate } from "../types";

type GroupListProps = {
  groups: GroupTemplate[];
  values: Record<string, number>;
  factors: Record<string, number>;
  groupTotals: Record<string, number>;
  stepResults: Record<string, number>;
  onValueChange: (stepId: string, value: number) => void;
};

export function GroupList(props: GroupListProps) {
  return (
    <section className="group-list">
      {props.groups.map((group) => (
        <article className="group-card" key={group.id}>
          <header className="group-head">
            <h3>{group.title}</h3>
            <p>{group.description}</p>
            <div className="group-total">
              Grup Toplami:{" "}
              <strong>{(props.groupTotals[group.id] ?? 0).toFixed(2)}</strong>{" "}
              kgCO2e
            </div>
          </header>

          <div className="step-table" role="table" aria-label={group.title}>
            <div className="step-row step-header" role="row">
              <span role="columnheader">Adim</span>
              <span role="columnheader">Miktar</span>
              <span role="columnheader">Katsayi</span>
              <span role="columnheader">Sonuc (kgCO2e)</span>
            </div>

            {group.steps.map((step) => (
              <div className="step-row" role="row" key={step.id}>
                <label
                  className="step-label"
                  role="cell"
                  htmlFor={`value-${step.id}`}
                >
                  {step.label}
                  <small>Birim: {step.unit}</small>
                </label>
                <input
                  role="cell"
                  id={`value-${step.id}`}
                  type="number"
                  min={0}
                  step="any"
                  value={props.values[step.id] ?? 0}
                  onChange={(event) =>
                    props.onValueChange(
                      step.id,
                      Number(event.target.value) || 0,
                    )
                  }
                />
                <span role="cell" className="factor-pill">
                  {(props.factors[step.id] ?? step.factor).toFixed(2)}
                </span>
                <strong role="cell" className="step-result">
                  {(props.stepResults[step.id] ?? 0).toFixed(2)}
                </strong>
              </div>
            ))}
          </div>
        </article>
      ))}
    </section>
  );
}
