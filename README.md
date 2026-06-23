# FEMO Stats

Occupational health analytics tool for Ecuador's official FEMO form (Formulario de Evaluación Médica Ocupacional, MSP).

## What it does

Occupational physicians and workplace health officers deal with a fragmented process: each worker evaluation is filled out in an individual Excel file, printed, signed, and filed — leaving no consolidated view of the workforce's health status over time.

FEMO Stats solves this by letting the physician upload each FEMO file directly into the platform. The tool extracts the structured data automatically and builds a real-time dashboard showing the health profile of the entire workforce per company.

## Who it's for

- Occupational physicians managing health evaluations across one or more companies
- Workplace health and safety officers (SST) responsible for reporting and planning

## What you can see

- **Fitness for work** — distribution of fit, restricted, and unfit results by job position
- **Anthropometric profile** — BMI classification across the workforce, blood pressure levels
- **Occupational risk exposure** — most common risk factors by frequency across all workers
- **Lifestyle indicators** — smoking prevalence
- **Worker registry** — full list of evaluated workers with exam count per person

## Data privacy

This tool stores health data classified as sensitive under Ecuador's LOPDP (Art. 4). The physician using the platform acts as the data controller; the platform operator acts as the data processor. A data processing agreement between both parties is required before loading real worker data.

## Stack

React · Supabase · Netlify