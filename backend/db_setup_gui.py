import os
import sys
import tkinter as tk
from tkinter import ttk, messagebox
from sqlalchemy import create_engine, text

def prompt_db_credentials(env_path):
    existing_host = "localhost"
    existing_port = "5432"
    existing_user = "postgres"
    existing_pass = ""
    existing_name = "ToolCrib_v1"

    if os.path.exists(env_path):
        try:
            with open(env_path, "r") as f:
                for line in f:
                    if "=" in line and not line.strip().startswith("#"):
                        k, v = line.strip().split("=", 1)
                        if k == "DB_HOST": existing_host = v
                        elif k == "DB_PORT": existing_port = v
                        elif k == "DB_USER": existing_user = v
                        elif k == "DB_PASSWORD": existing_pass = v
                        elif k == "DB_NAME": existing_name = v
        except Exception:
            pass

    root = tk.Tk()
    root.title("ToolCrib Software - Database Configuration")
    root.geometry("480x420")
    root.resizable(False, False)

    # Center window on screen
    root.eval('tk::PlaceWindow . center')

    # Styling
    style = ttk.Style()
    style.theme_use('clam')

    header_frame = tk.Frame(root, bg="#1890ff", pady=15, padx=15)
    header_frame.pack(fill="x")

    tk.Label(header_frame, text="ToolCrib Software Setup", font=("Segoe UI", 16, "bold"), fg="white", bg="#1890ff").pack()
    tk.Label(header_frame, text="Enter your PostgreSQL Database Credentials", font=("Segoe UI", 10), fg="#e6f7ff", bg="#1890ff").pack(pady=2)

    form_frame = ttk.Frame(root, padding=20)
    form_frame.pack(fill="both", expand=True)

    labels = ["Database Host:", "Database Port:", "Database User:", "Database Password:", "Database Name:"]
    defaults = [existing_host, existing_port, existing_user, existing_pass, existing_name]
    entries = []

    for i, (lbl_text, default_val) in enumerate(zip(labels, defaults)):
        ttk.Label(form_frame, text=lbl_text, font=("Segoe UI", 9, "bold")).grid(row=i, column=0, sticky="w", pady=8)
        entry = ttk.Entry(form_frame, width=32, show="*" if "Password" in lbl_text else "")
        entry.insert(0, default_val)
        entry.grid(row=i, column=1, sticky="e", pady=8, padx=10)
        entries.append(entry)

    host_entry, port_entry, user_entry, pass_entry, name_entry = entries

    success = [False]

    def save_and_test():
        host = host_entry.get().strip()
        port = port_entry.get().strip()
        user = user_entry.get().strip()
        password = pass_entry.get().strip()
        dbname = name_entry.get().strip()

        if not host or not user or not dbname:
            messagebox.showerror("Validation Error", "Host, Username, and Database Name are required!")
            return

        db_url = f"postgresql://{user}:{password}@{host}:{port}/{dbname}"
        
        # Test connection
        try:
            engine = create_engine(db_url, connect_args={'connect_timeout': 4})
            with engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            messagebox.showinfo("Success", "Database connection successful!")
        except Exception as e:
            errMsg = str(e)
            if not messagebox.askyesno("Database Connection Failed", f"Could not connect to database:\n\n{errMsg}\n\nDo you still want to save these settings and continue?"):
                return

        # Save to .env
        env_text = (
            f"DB_HOST={host}\n"
            f"DB_PORT={port}\n"
            f"DB_USER={user}\n"
            f"DB_PASSWORD={password}\n"
            f"DB_NAME={dbname}\n"
            f"DATABASE_URL={db_url}\n"
        )
        with open(env_path, "w") as f:
            f.write(env_text)

        os.environ["DB_HOST"] = host
        os.environ["DB_PORT"] = port
        os.environ["DB_USER"] = user
        os.environ["DB_PASSWORD"] = password
        os.environ["DB_NAME"] = dbname
        os.environ["DATABASE_URL"] = db_url

        success[0] = True
        root.destroy()

    btn_frame = ttk.Frame(root)
    btn_frame.pack(fill="x", pady=10)

    save_btn = ttk.Button(btn_frame, text="Save & Connect Database", command=save_and_test)
    save_btn.pack(ipady=5, ipadx=10)

    root.mainloop()
    return success[0]

if __name__ == "__main__":
    prompt_db_credentials(".env")
