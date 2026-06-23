import os 
import pandas as pd 
import numpy as np
from supabase import create_client, Client

url: str = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
key: str = os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")
supabase: Client = create_client(url, key)

response = (supabase.table("drawings")).select("*").execute()
df = pd.DataFrame(response.data)

#drop the laptop function
def is_laptop_drawing(points):
    if not points:
        return True
    return points[0].get("p") == 500

laptop_mask = df["drawing_data"].apply(is_laptop_drawing)
print(f"Dropping {laptop_mask.sum()} rows recorded without pressure (likely laptop/mouse)")
df = df[~laptop_mask]

#sort by the function whether or not it was doen before the ipad values were locked
LOCK_DATE = pd.Timestamp("2026-06-05", tz="UTC")

def split_by_lock_date(df, lock_date=LOCK_DATE):
    created_at = pd.to_datetime(df["created_at"], utc=True)
    non_locked_drawing_cards = df[created_at < lock_date]
    locked_drawing_cards = df[created_at >= lock_date]
    return non_locked_drawing_cards, locked_drawing_cards

non_locked_drawing_cards, locked_drawing_cards = split_by_lock_date(df)
print(f"Non-locked drawings (before {LOCK_DATE.date()}): {len(non_locked_drawing_cards)}")
print(f"Locked drawings (on/after {LOCK_DATE.date()}): {len(locked_drawing_cards)}")

8