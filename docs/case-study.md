# Analytical readout

Synthetic portfolio, 100,000 applications, January through June 2025. All figures below come from the committed governed dashboard snapshot. They describe a generated case study, not a real lender's performance.

## Findings

| Observation | Published evidence | Next question |
| --- | --- | --- |
| Bank connection loses one in five starters | 14,091 of 70,127 starters do not complete; 20.1% | Which device/browser cuts carry the friction? |
| Approval does not guarantee funding | 13,065 of 22,351 approved applications fund; 58.5% | Where do approved applicants stop before signing and funding? |
| Manual decisions take longer | Median submission-to-decision: automated 18.2 minutes, manual 2,008.5 minutes | How much is case mix versus process delay? |
| The clarity treatment has higher completion | Control 74.1%; treatment 85.7%; difference +11.6 percentage points, 95% interval +11.0 to +12.1 | Are the guardrail movements acceptable? |

End-to-end funding is 13,065 / 100,000, or 13.1%. Submission is 45,692 / 100,000, or 45.7%. Approval is 22,351 / 45,692 decided applications, or 48.9%. These percentages use different denominators and should not be added or compared as adjacent losses.

## Interpretation boundaries

Approval is an outcome branch: declines and referrals are not applicant abandonment. Bank failure events can occur before eventual completion, so failure and completion rates overlap. Underwriting path and risk comparisons are descriptive and do not adjust for case mix.

The experiment assigns applications at start, but its primary metric includes only subsequent bank connection starters (control 35,016; treatment 35,111). This conditional population is not an intention-to-treat estimate over every assigned application. The exported test uses a two-proportion z test and a Wald interval. Secondary and exploratory results are not a substitute for a prespecified business decision.

The export has no launch decision, numeric guardrail tolerances, or SLA targets. Formal sensitivity analysis and causal diagnosis remain future analytical work. The presentation keeps these gaps explicit.

## Presentation route

1. Overview: explain the funding outcome and the three findings.
2. Application funnel: distinguish stage friction from decision outcomes; inspect device/browser and channel cuts.
3. Operations: compare decision paths, then the approval-to-funding clock.
4. Experiment: read the effect with its uncertainty and the missing launch criteria.
5. Ask LendFlow: retrieve a published answer and its supporting query.

Filters select one published slice at a time. Comparisons marked Portfolio remain fixed. No device-by-channel intersection is inferred.
