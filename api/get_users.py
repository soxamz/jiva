import os
import psycopg2
from dotenv import load_dotenv

# Load the DATABASE_URL from your .env file
load_dotenv() 

try:
    conn = psycopg2.connect(os.getenv("DATABASE_URL"))
    cursor = conn.cursor()
    
    # Query the users table for valid patients
    cursor.execute("SELECT id, name, role FROM users WHERE role = 'patient' LIMIT 5;")
    rows = cursor.fetchall()
    
    print("\n✅ VALID PATIENT IDs YOU CAN USE FOR TESTING:")
    print("-" * 50)
    for row in rows:
        print(f"ID: {row[0]} | Name: {row[1]} | Role: {row[2]}")
        
    if not rows:
        print("⚠️ The 'users' table is empty. Tell the frontend team to register a dummy user first.")

    cursor.close()
    conn.close()
except Exception as e:
    print(f"Database connection failed: {e}")