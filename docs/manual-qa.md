# ClimateOps Manual QA Checklist

Record the date, commit, environment, tester, data sources, and browser/runtime for each run.

## Core Checks

- [ ] The application starts using the documented setup.
- [ ] A valid location can be searched and confirmed.
- [ ] Risk categories show a value, severity, timestamp, and source.
- [ ] Recommendations correspond to the displayed risk and include safety context.
- [ ] Missing or stale data is clearly identified.
- [ ] Invalid input produces a useful validation message.
- [ ] Network or provider failure produces an explicit error and retry path.

## Monitoring Checks

- [ ] Monitored locations list the last successful update.
- [ ] Active incidents show location, hazard, severity, source, and status.
- [ ] Incident changes are visible in the timeline.
- [ ] Duplicate observations do not create misleading duplicate incidents.
- [ ] Resolved incidents remain distinguishable from active incidents.

## Accessibility and Responsive Checks

- [ ] Complete primary flows using only the keyboard.
- [ ] Focus order and focus visibility are understandable.
- [ ] Headings, labels, and error messages are available to assistive technology.
- [ ] Risk severity is communicated without color alone.
- [ ] Primary flows work at mobile, tablet, and desktop widths.
- [ ] Text remains readable when enlarged.

## Safety and Data Checks

- [ ] Provider attribution and timestamps are visible where required.
- [ ] Official-warning links or references are not presented as ClimateOps predictions.
- [ ] Emergency copy does not imply guaranteed accuracy.
- [ ] No credentials or personal data appear in logs, screenshots, or reports.
- [ ] Time zones and absolute dates are unambiguous.

## Evidence

For failures, capture the smallest useful reproduction, expected result, actual result, environment, and relevant timestamp. Redact secrets and personal information.
