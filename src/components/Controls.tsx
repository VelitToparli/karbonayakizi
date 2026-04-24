import type { PeriodType } from "../types";

type ControlsProps = {
  companyName: string;
  periodType: PeriodType;
  month: number;
  year: number;
  statusMessage: string;
  onCompanyNameChange: (value: string) => void;
  onPeriodTypeChange: (value: PeriodType) => void;
  onMonthChange: (value: number) => void;
  onYearChange: (value: number) => void;
};

export function Controls(props: ControlsProps) {
  return (
    <section className="controls">
      <label>
        Sirket / Tesis
        <input
          type="text"
          placeholder="Ornek: Merkez Uretim Tesisi"
          value={props.companyName}
          onChange={(event) => props.onCompanyNameChange(event.target.value)}
        />
      </label>
      <label>
        Donem Tipi
        <select
          value={props.periodType}
          onChange={(event) =>
            props.onPeriodTypeChange(event.target.value as PeriodType)
          }
        >
          <option value="monthly">Aylik</option>
          <option value="yearly">Yillik</option>
        </select>
      </label>
      {props.periodType === "monthly" ? (
        <label>
          Ay
          <input
            type="number"
            min={1}
            max={12}
            value={props.month}
            onChange={(event) =>
              props.onMonthChange(Number(event.target.value) || 1)
            }
          />
        </label>
      ) : (
        <div />
      )}
      <label>
        Yil
        <input
          type="number"
          min={2000}
          max={2100}
          value={props.year}
          onChange={(event) =>
            props.onYearChange(
              Number(event.target.value) || new Date().getFullYear(),
            )
          }
        />
      </label>
      <p className="status-message">{props.statusMessage}</p>
    </section>
  );
}
