import pandas as pd
import psycopg2
from io import StringIO


def import_tools_data():
    try:
        # Database connection parameters
        db_params = {
            'host': 'localhost',
            'dbname': 'postgres',
            'user': 'postgres',
            'password': '12345678',
            'port': '5432'
        }

        # --- 1. Load Excel file ---
        print("Loading Excel file...")
        excel_file_path = "tools_data.xlsx"
        df = pd.read_excel(excel_file_path)
        print("✅ Excel file loaded successfully")
        print(f"Found columns in Excel: {', '.join(df.columns)}")

        # --- 2. Clean and convert column names ---
        print("Cleaning column names...")

        # First, standardize the Excel column names - strip spaces
        df.columns = df.columns.str.strip()
        print(f"Columns after stripping spaces: {', '.join(df.columns)}")

        # Create a mapping from your Excel columns to database columns
        column_mapping = {
            # Your new Excel format (from screenshot 1)
            'Sl no': 'Sl_no',  # This will be dropped later
            'Item Description': 'Item_Description',
            'Range in mm': 'Range_in_mm',
            'Identification Code': 'Identification_Code',
            'Make': 'Make',
            'Quantity': 'Quantity',
            'Location': 'Location',
            'Gauge': 'Gauge',
            'Remarks': 'Remarks',

            # Alternative formats in case column names vary
            'Item_Description': 'Item_Description',
            'Range_in_mm': 'Range_in_mm',
            'Identification_Code': 'Identification_Code',
            'ITEM_DESCRIPTION': 'Item_Description',
            'RANGE_IN_MM': 'Range_in_mm',
            'IDENTIFICATION_CODE': 'Identification_Code',
            'MAKE': 'Make',
            'QUANTITY': 'Quantity',
            'LOCATION': 'Location',
            'GAUGE': 'Gauge',
            'REMARKS': 'Remarks'
        }

        # Required database columns (excluding Sl_no as it's auto-generated)
        required_columns = {
            'Item_Description',
            'Range_in_mm',
            'Identification_Code',
            'Make',
            'Quantity',
            'Location',
            'Gauge',
            'Remarks'
        }

        # Check which columns from Excel match our required columns
        excel_columns = set(df.columns)
        mapped_columns = {}

        for excel_col in excel_columns:
            if excel_col in column_mapping:
                mapped_columns[excel_col] = column_mapping[excel_col]

        print(f"Column mapping: {mapped_columns}")

        # Verify we have all required columns
        mapped_db_columns = set(mapped_columns.values())
        missing_columns = required_columns - mapped_db_columns

        if missing_columns:
            print(f"❌ Missing required columns: {', '.join(missing_columns)}")
            print("Expected Excel columns should be:")
            print("- Item Description")
            print("- Range in mm")
            print("- Identification Code")
            print("- Make")
            print("- Quantity")
            print("- Location")
            print("- Gauge")
            print("- Remarks")
            print(f"Found Excel columns: {', '.join(excel_columns)}")
            return

        # Rename columns to match database
        print("Mapping columns...")
        df = df.rename(columns=mapped_columns)
        print(f"Final columns after mapping: {', '.join(df.columns)}")

        # Drop Sl_no if present (it's auto-generated in database)
        if "Sl_no" in df.columns:
            df = df.drop(columns=["Sl_no"])
            print("✅ Dropped Sl_no column (will be auto-generated)")

        # Keep only the required columns
        df = df[list(required_columns)]
        print(f"Final columns for import: {', '.join(df.columns)}")

        # --- 3. Data type cleanup ---
        print("Converting data types...")
        try:
            # Handle Quantity column - ensure it's numeric
            df["Quantity"] = pd.to_numeric(df["Quantity"], errors="coerce")
            df["Quantity"] = df["Quantity"].fillna(0)  # Replace NaN with 0
            print("✅ Quantity conversion successful")

            # Replace NaN with empty string for all text columns
            string_columns = [col for col in df.columns if col != "Quantity"]
            df[string_columns] = df[string_columns].fillna('')

            # Convert all string columns to string type
            for col in string_columns:
                df[col] = df[col].astype(str)

            print("✅ Replaced NaN values with empty strings in text columns")

        except Exception as e:
            print(f"❌ Error converting data types: {str(e)}")
            print(f"Available columns: {', '.join(df.columns)}")
            return

        # Set status based on Quantity
        df["status"] = df["Quantity"].apply(lambda x: "not_available" if not x or x <= 0 else "available")
        print("✅ Status column added based on quantity")

        print(f"Data preview (first 3 rows):")
        print(df.head(3))
        print(f"Total rows to import: {len(df)}")

        # --- 4. Insert into DB ---
        print("Connecting to database...")
        conn_str = f"host={db_params['host']} dbname={db_params['dbname']} user={db_params['user']} password={db_params['password']} port={db_params['port']}"

        with psycopg2.connect(conn_str) as conn:
            with conn.cursor() as cur:
                # Create a string buffer
                output = StringIO()
                # Convert dataframe to csv format in memory
                df.to_csv(output, sep='\t', header=False, index=False)
                output.seek(0)

                print("Inserting data into database...")
                try:
                    # Use COPY command for fast data insertion
                    columns_quoted = [f'"{col}"' for col in df.columns]
                    cur.copy_from(
                        file=output,
                        table='toolcrib.tools_list',
                        columns=columns_quoted,
                        sep='\t',
                        null=''
                    )
                    conn.commit()
                    print(f"✅ Successfully imported {len(df)} rows into toolcrib.tools_list")

                    # Verify the import
                    cur.execute("SELECT COUNT(*) FROM toolcrib.tools_list")
                    total_count = cur.fetchone()[0]
                    print(f"✅ Total records in database: {total_count}")

                except Exception as e:
                    conn.rollback()
                    print(f"❌ Error during COPY command: {str(e)}")

                    # Fallback to row-by-row insertion if COPY fails
                    print("Attempting row-by-row insertion...")
                    success_count = 0
                    for idx, row in df.iterrows():
                        try:
                            placeholders = ','.join(['%s'] * len(row))
                            columns = ','.join(f'"{col}"' for col in df.columns)
                            insert_query = f'INSERT INTO toolcrib.tools_list ({columns}) VALUES ({placeholders})'
                            cur.execute(insert_query, list(row))
                            conn.commit()
                            success_count += 1
                            if success_count % 100 == 0:  # Print progress every 100 rows
                                print(f"Inserted {success_count}/{len(df)} rows", end='\r')
                        except Exception as insert_error:
                            conn.rollback()
                            print(f"\n❌ Error inserting row {idx + 1}: {str(insert_error)}")
                            print(f"Row data: {list(row)}")
                            continue
                    print(f"\n✅ Row-by-row insertion completed. Successfully inserted {success_count} rows")

    except FileNotFoundError:
        print("❌ Excel file 'tools_data.xlsx' not found in current directory")
        print("Please make sure the file exists and the name is correct")
    except Exception as e:
        print(f"❌ Error importing data: {str(e)}")
        print("Please check if:")
        print("1. The Excel file exists and is not corrupted")
        print("2. The column names match: 'Item Description', 'Range in mm', etc.")
        print("3. The database connection parameters are correct")
        print("4. The database schema 'toolcrib' and table 'tools_list' exist")


if __name__ == "__main__":
    import_tools_data()