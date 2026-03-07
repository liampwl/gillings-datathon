# Diabetes Risk Screening Tool

A locally hosted Node.js demo application for diabetes risk screening using logistic regression.

## Features

- Form-based UI collecting demographics, lifestyle factors, healthcare access, and medical history.
- `/predict` REST API endpoint powered by a configurable logistic regression model
- Risk classification: **Low**, **Moderate**, or **High**
- Coefficients stored in `model/coefficients.json` — easy to update without touching server code

## Project Structure

```
.
├── model/
│   └── coefficients.json   # Logistic regression coefficients
├── public/
│   ├── index.html          # Frontend form
│   ├── style.css           # Styling
│   └── app.js              # Frontend JavaScript
├── server/
│   └── index.js            # Express server & /predict endpoint
├── package.json
└── README.md
```

## Prerequisites

- [Node.js](https://nodejs.org/) v14 or later

## Running Locally

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Start the server**

   ```bash
   npm start
   ```

3. **Open the app**

   Navigate to [http://localhost:3000](http://localhost:3000) in your browser.

## API Reference

### `POST /predict`

**Request body (JSON):**

| Field | Type | Description |
|------------------|------------------|------------------------------------|
| `age` | integer | BRFSS age category `1-13` |
| `bmi` | number | Body Mass Index (calculated from height and weight) |
| `HighBP` | 0 or 1 | High Blood Pressure |
| `HighChol` | 0 or 1 | High Cholesterol |
| `CholCheck` | 0 or 1 | Cholesterol check in last 5 years |
| `Smoker` | 0 or 1 | Smoked at least 100 cigarettes lifetime |
| `Stroke` | 0 or 1 | Ever had a stroke |
| `HeartDiseaseorAttack` | 0 or 1 | Coronary heart disease or myocardial infarction |
| `PhysActivity` | 0 or 1 | Physical activity in past 30 days |
| `Fruits` | 0 or 1 | Fruit consumption at least once/day |
| `Veggies` | 0 or 1 | Vegetable consumption at least once/day |
| `HvyAlcoholConsump` | 0 or 1 | Heavy alcohol consumption |
| `AnyHealthcare` | 0 or 1 | Any healthcare coverage |
| `NoDocbcCost` | 0 or 1 | Could not see doctor due to cost |
| `GenHlth` | integer | General health `1-5` |
| `MentHlth` | integer | Mental health not good days `0-30` |
| `PhysHlth` | integer | Physical health not good days `0-30` |
| `DiffWalk` | 0 or 1 | Serious difficulty walking/climbing stairs |
| `Sex` | 0 or 1 | BRFSS encoding used by model |
| `Education` | integer | BRFSS education category `1-6` |
| `Income` | integer | BRFSS income category `1-8` |

`zipCode` remains optional in the UI for health-center lookup only and is not sent to `/predict`.

**Response (JSON):**

```json
{
  "probability": 0.3821,
  "riskCategory": "Moderate"
}
```

`riskCategory` is one of:
- `"Low"` — probability < 30%
- `"Moderate"` — probability 30–59%
- `"High"` — probability ≥ 60%

## Configuring the Model

Edit `model/coefficients.json` to adjust the logistic regression coefficients:

```json
{
   "intercept": -6.7216627,
   "age": 0.1480461,
   "bmi": 0.0739089,
   "HighBP": 0.7422317,
   "HighChol": 0.5790892,
   "CholCheck": 1.3084764,
   "Smoker": 0.0149922,
   "Stroke": 0.1778546,
   "HeartDiseaseorAttack": 0.2483434,
   "PhysActivity": -0.0463223,
   "Fruits": -0.0559529,
   "Veggies": -0.0392314,
   "HvyAlcoholConsump": -0.7400404,
   "AnyHealthcare": 0.0685388,
   "NoDocbcCost": 0.0159736,
   "GenHlth": 0.5794343,
   "MentHlth": -0.0042874,
   "PhysHlth": -0.0078709,
   "DiffWalk": 0.0955270,
   "Sex": 0.2783527,
   "Education": -0.0375024,
   "Income": -0.0597731
}
```

Coefficients are loaded dynamically on every request, so you **do not** need to restart the server after making changes to `coefficients.json`.