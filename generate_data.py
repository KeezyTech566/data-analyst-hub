import numpy as np
import pandas as pd

# Supported enterprise industry templates
SCHEMAS = {
    "1": {
        "industry": "Retail & E-commerce",
        "prefix": "RET",
        "categories": ["Electronics", "Apparel", "Home & Kitchen", "Beauty", "Sports"],
        "sub_categories": ["Flagship", "Budget", "Premium", "Refurbished", "Clearance"],
        "num_col_1": ("Units_Sold", lambda n: np.random.randint(5, 500, size=n)),
        "num_col_2": ("Unit_Price_USD", lambda n: np.round(np.random.uniform(10.0, 850.0, size=n), 2)),
        "num_col_3": ("Discount_Pct", lambda n: np.round(np.random.uniform(0.0, 0.35, size=n), 2)),
        "num_col_4": ("Customer_Rating", lambda n: np.round(np.random.uniform(2.5, 5.0, size=n), 1)),
        "rls_col_1": ("Supplier_Cost_USD", lambda n: np.round(np.random.uniform(5.0, 450.0, size=n), 2)),
        "rls_col_2": ("Net_Profit_USD", lambda n: np.round(np.random.uniform(20.0, 12000.0, size=n), 2))
    },
    "2": {
        "industry": "Supply Chain & Logistics",
        "prefix": "LOG",
        "categories": ["North Hub", "South Terminal", "Central Corridor", "Coastal Port", "Border Post"],
        "sub_categories": ["Heavy Haulage", "Express Van", "Cold Chain", "Intermodal", "Last-Mile"],
        "num_col_1": ("Trip_Distance_KM", lambda n: np.random.randint(50, 2500, size=n)),
        "num_col_2": ("Fuel_Liters", lambda n: np.round(np.random.uniform(40.0, 950.0, size=n), 1)),
        "num_col_3": ("Delivery_Delay_Mins", lambda n: np.random.randint(0, 180, size=n)),
        "num_col_4": ("Fleet_Efficiency_Score", lambda n: np.round(np.random.uniform(60.0, 99.0, size=n), 1)),
        "rls_col_1": ("Driver_Salary_USD", lambda n: np.random.randint(1800, 5200, size=n)),
        "rls_col_2": ("Operational_Cost_USD", lambda n: np.round(np.random.uniform(500.0, 18500.0, size=n), 2))
    },
    "3": {
        "industry": "Healthcare & Pharmaceuticals",
        "prefix": "MED",
        "categories": ["Inpatient", "Outpatient", "Cardiology", "Diagnostics", "ICU"],
        "sub_categories": ["Emergency", "Elective", "Routine Screening", "Pediatric", "Post-Op"],
        "num_col_1": ("Patient_Stay_Days", lambda n: np.random.randint(1, 28, size=n)),
        "num_col_2": ("Treatment_Cycles", lambda n: np.random.randint(1, 12, size=n)),
        "num_col_3": ("Satisfaction_Index", lambda n: np.round(np.random.uniform(70.0, 98.0, size=n), 1)),
        "num_col_4": ("Medication_Units", lambda n: np.random.randint(10, 450, size=n)),
        "rls_col_1": ("Doctor_Fee_USD", lambda n: np.random.randint(800, 12000, size=n)),
        "rls_col_2": ("Department_Revenue_USD", lambda n: np.random.randint(5000, 150000, size=n))
    },
    "4": {
        "industry": "Financial Services & Banking",
        "prefix": "FIN",
        "categories": ["Equities", "Fixed Income", "Derivatives", "Commodities", "Arbitrage"],
        "sub_categories": ["Institutional", "Retail Advisory", "Hedge Allocation", "Treasury", "Private Equity"],
        "num_col_1": ("AUM_Millions", lambda n: np.round(np.random.uniform(5.0, 250.0, size=n), 2)),
        "num_col_2": ("Quarterly_Return_Pct", lambda n: np.round(np.random.normal(7.2, 3.8, size=n), 2)),
        "num_col_3": ("Volatility_Index", lambda n: np.round(np.random.uniform(5.0, 38.0, size=n), 2)),
        "num_col_4": ("Trade_Volume_K", lambda n: np.random.randint(100, 5000, size=n)),
        "rls_col_1": ("Executive_Bonus_USD", lambda n: np.random.randint(5000, 75000, size=n)),
        "rls_col_2": ("Net_Revenue_USD", lambda n: np.random.randint(50000, 4500000, size=n))
    }
}

def generate_enterprise_csv():
    print("==================================================")
    print("   DATA ANALYST HUB - UNIVERSAL DATASET GENERATOR  ")
    print("==================================================")
    biz_name = input("Enter Business Name (e.g. Apex Cargo, Zenith Health): ").strip()
    if not biz_name:
        biz_name = "Enterprise_Business"

    print("\nSelect Business Industry:")
    for key, schema in SCHEMAS.items():
        print(f"[{key}] {schema['industry']}")
    
    choice = input("Enter choice (1-4, default 1): ").strip()
    config = SCHEMAS.get(choice, SCHEMAS["1"])

    rows_str = input("\nEnter number of records to generate (e.g. 10000, 100000, 1000000): ").strip()
    total_rows = int(rows_str) if rows_str.isdigit() else 50000

    print(f"\nGenerating {total_rows:,} records for '{biz_name}' ({config['industry']})...")
    np.random.seed(42)

    # Vectorized synthesis for rapid generation
    record_ids = [f"{config['prefix']}-{i:07d}" for i in range(1, total_rows + 1)]
    category_col = np.random.choice(config["categories"], size=total_rows)
    segment_col = np.random.choice(config["sub_categories"], size=total_rows)

    data = {
        "Record_ID": record_ids,
        "Operational_Unit": category_col,
        "Segment_Classification": segment_col,
        config["num_col_1"][0]: config["num_col_1"][1](total_rows),
        config["num_col_2"][0]: config["num_col_2"][1](total_rows),
        config["num_col_3"][0]: config["num_col_3"][1](total_rows),
        config["num_col_4"][0]: config["num_col_4"][1](total_rows),
        # Sensitive fields to validate backend Row-Level Security masking
        config["rls_col_1"][0]: config["rls_col_1"][1](total_rows),
        config["rls_col_2"][0]: config["rls_col_2"][1](total_rows)
    }

    df = pd.DataFrame(data)
    safe_filename = f"{biz_name.replace(' ', '_')}_{config['industry'].split()[0]}_{total_rows}rows.csv"
    
    print(f"Writing dataset to {safe_filename}...")
    df.to_csv(safe_filename, index=False)
    print(f"SUCCESS: Created {safe_filename} with {total_rows:,} records ready for analysis!")

if __name__ == "__main__":
    generate_enterprise_csv()
