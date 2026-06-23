"""
Compare, for each locked drawing, the metrics already stored in api_results
(the "pre" values, computed whenever that drawing was originally analyzed)
against metrics produced by re-running the same raw drawing_data through
spiralanalysis.com/api/analyze right now (the "post" values), after applying
the same client-side scale/centering transform backgroundAnalysis() in
src/app/machine/page.jsx applies before sending data to that route.
"""
import math
import os
import re
import time

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import requests
from supabase import Client, create_client

LOCK_DATE = pd.Timestamp("2026-06-05", tz="UTC")
OUT_DIR = os.path.dirname(os.path.abspath(__file__))


def scale_drawing_data(drawing_data, device_pixel_ratio):
    """Line-by-line port of backgroundAnalysis() in src/app/machine/page.jsx
    (lines 218-235). drawing_data here = the JS `drawingData` param, i.e. the
    raw points exactly as saved to the drawings table.

        const cssPpi = 264 / (window.devicePixelRatio || 1);
        const scale = 200 / cssPpi / 8;
        const firstY = drawingData[0].y;
        const scaledData = drawingData.map((pt) => ({
          ...pt,
          x: +(pt.x * scale).toFixed(4),
          y: +((pt.y - firstY) * scale + 150).toFixed(4),
        }));
    """
    css_ppi = 264 / (device_pixel_ratio or 1)
    scale = 200 / css_ppi / 8
    first_y = drawing_data[0]["y"]
    scaled_data = []
    for pt in drawing_data:
        scaled_pt = dict(pt)
        scaled_pt["x"] = round(pt["x"] * scale, 4)
        scaled_pt["y"] = round((pt["y"] - first_y) * scale + 150, 4)
        scaled_data.append(scaled_pt)
    return scaled_data


def load_env_file(path=".env.local"):
    if not os.path.exists(path):
        return
    with open(path) as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip())


load_env_file()

url: str = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
key: str = os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")
supabase: Client = create_client(url, key)


def is_laptop_drawing(points):
    if not points:
        return True
    return points[0].get("p") == 500


def coerce_value(v):
    if v is None:
        return np.nan
    if isinstance(v, (int, float)):
        return float(v)
    if isinstance(v, str):
        s = v.strip()
        if not s:
            return np.nan
        if re.fullmatch(r"no axis", s, re.I):
            return np.nan
        if re.fullmatch(r"inf(inity)?", s, re.I):
            return np.inf
        try:
            return float(s)
        except ValueError:
            return np.nan
    return np.nan


def fetch_pre_result(drawing_id):
    resp = (
        supabase.table("api_results")
        .select("*")
        .eq("drawing_id", drawing_id)
        .eq("status", "completed")
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )
    rows = resp.data
    return rows[0]["result_data"] if rows else None


ANALYZE_PROXY_URL = "https://www.spiralanalysis.com/api/analyze"
DEVICE_PIXEL_RATIO = 2  # confirmed: capture device is an iPad 11 Pro, no zoom -> dpr 2


def run_api(drawing_data):
    """Mirrors backgroundAnalysis() in machine/page.jsx: scale the raw points
    the same way the browser does, then POST through the app's own
    /api/analyze route (not the external URL directly) with the same
    { drawData: scaledData } body shape."""
    scaled = scale_drawing_data(drawing_data, DEVICE_PIXEL_RATIO)
    resp = requests.post(
        ANALYZE_PROXY_URL,
        json={"drawData": scaled},
        headers={"Content-Type": "application/json"},
        timeout=120,
    )
    body = resp.json()
    if not resp.ok:
        raise ValueError(f"/api/analyze returned {resp.status_code}: {body}")
    data = body.get("result")
    if not isinstance(data, dict):
        raise ValueError(f"API returned non-object result: {data!r}")
    return data


def load_locked_drawings():
    response = supabase.table("drawings").select("*").execute()
    df = pd.DataFrame(response.data)
    laptop_mask = df["drawing_data"].apply(is_laptop_drawing)
    df = df[~laptop_mask]
    created_at = pd.to_datetime(df["created_at"], utc=True)
    return df[created_at >= LOCK_DATE]


def build_comparison(locked):
    records = []
    n = len(locked)
    for i, (_, row) in enumerate(locked.iterrows(), start=1):
        drawing_id = row["id"]
        pre = fetch_pre_result(drawing_id)
        if not isinstance(pre, dict):
            print(f"[{i}/{n}] {drawing_id}: no usable stored api_results, skipping")
            continue

        print(f"[{i}/{n}] {drawing_id}: re-running through /api/analyze...")
        t0 = time.time()
        try:
            post = run_api(row["drawing_data"])
        except Exception as e:
            print(f"[{i}/{n}] {drawing_id}: API error ({e}), skipping")
            continue
        print(f"[{i}/{n}] {drawing_id}: done in {time.time() - t0:.1f}s")

        for metric in set(pre.keys()) | set(post.keys()):
            pre_v = coerce_value(pre.get(metric))
            post_v = coerce_value(post.get(metric))
            if not (np.isfinite(pre_v) and np.isfinite(post_v)):
                continue
            pct_change = (
                (post_v - pre_v) / abs(pre_v) * 100 if pre_v != 0 else np.nan
            )
            records.append(
                {
                    "drawing_id": drawing_id,
                    "metric": metric,
                    "pre": pre_v,
                    "post": post_v,
                    "diff": post_v - pre_v,
                    "pct_change": pct_change,
                }
            )

    return pd.DataFrame(records)


CAVEAT_TEXT = (
    "Caution: DOS converges to a constant 4.0 and Tightness collapses toward 0 for every\n"
    "re-run drawing, regardless of input -- this looks like an artifact of calling the\n"
    "external API directly rather than a verified pipeline improvement. See pre_post_metrics.csv."
)


def add_caveat(fig):
    fig.text(0.5, 0.005, CAVEAT_TEXT, ha="center", va="bottom", fontsize=8, color="firebrick")


def plot_summary(df, out_path, top_n=None, min_n=4):
    """Rank metrics by effect size (mean diff / std of the pre values), not
    raw % change. Power-type metrics often have pre values near zero, which
    makes % change blow up to absurd magnitudes and drowns out every other
    metric. Normalizing by each metric's own spread keeps everything on a
    comparable scale."""
    grouped = df.groupby("metric")
    stats = grouped.agg(
        mean_diff=("diff", "mean"),
        pre_std=("pre", "std"),
        n=("diff", "count"),
    )
    stats = stats[(stats["n"] >= min_n) & (stats["pre_std"] > 0)]
    stats["effect_size"] = stats["mean_diff"] / stats["pre_std"]
    diff_std = grouped["diff"].std()
    stats["diff_std"] = diff_std.reindex(stats.index)
    stats["effect_size_err"] = stats["diff_std"] / stats["pre_std"]
    summary = stats.sort_values("effect_size", key=lambda s: s.abs(), ascending=False)
    if top_n:
        summary = summary.head(top_n)

    colors = ["tab:blue" if v >= 0 else "tab:orange" for v in summary["effect_size"]]
    fig, ax = plt.subplots(figsize=(10, max(5, 0.34 * len(summary))))
    ax.barh(
        summary.index[::-1],
        summary["effect_size"][::-1],
        xerr=summary["effect_size_err"][::-1].fillna(0),
        color=colors[::-1],
    )
    ax.tick_params(axis="y", labelsize=9)
    ax.axvline(0, color="black", linewidth=0.8)
    ax.set_xscale("symlog")
    ax.set_xlabel("Mean shift, post re-run vs. pre stored value\n(in units of that metric's own pre-value spread, symlog scale)")
    ax.set_title("Locked drawings: stored value vs. direct API re-run")
    fig.tight_layout(rect=(0, 0.035, 1, 1))
    add_caveat(fig)
    fig.savefig(out_path, dpi=150)
    plt.close(fig)
    return summary


def plot_headline_metrics(df, out_path, metrics=("DOS", "Tightness")):
    metrics = [m for m in metrics if m in df["metric"].unique()]
    if not metrics:
        return
    fig, axes = plt.subplots(1, len(metrics), figsize=(5 * len(metrics), 4.5), squeeze=False)
    axes = axes[0]

    for ax, metric in zip(axes, metrics):
        sub = df[df["metric"] == metric].sort_values("pre")
        for _, r in sub.iterrows():
            color = "tab:blue" if r["post"] >= r["pre"] else "tab:orange"
            ax.plot([0, 1], [r["pre"], r["post"]], color=color, alpha=0.6, marker="o")
        ax.set_xlim(-0.3, 1.3)
        ax.set_xticks([0, 1])
        ax.set_xticklabels(["pre\n(stored)", "post\n(re-run)"])
        ax.set_title(metric)

    fig.suptitle("Headline metrics: stored value vs. direct API re-run")
    fig.tight_layout(rect=(0, 0.06, 1, 1))
    add_caveat(fig)
    fig.savefig(out_path, dpi=150)
    plt.close(fig)


def plot_slope_grid(df, metrics, out_path, ncols=4):
    nrows = math.ceil(len(metrics) / ncols)
    fig, axes = plt.subplots(nrows, ncols, figsize=(4 * ncols, 3.2 * nrows), squeeze=False)
    axes = axes.flatten()

    for ax, metric in zip(axes, metrics):
        sub = df[df["metric"] == metric]
        for _, r in sub.iterrows():
            color = "tab:blue" if r["post"] >= r["pre"] else "tab:orange"
            ax.plot([0, 1], [r["pre"], r["post"]], color=color, alpha=0.6, marker="o", markersize=3)
        ax.set_xlim(-0.3, 1.3)
        ax.set_xticks([0, 1])
        ax.set_xticklabels(["pre\n(stored)", "post\n(re-run)"])
        ax.set_title(metric, fontsize=10)

    for ax in axes[len(metrics):]:
        ax.axis("off")

    fig.suptitle("Per-drawing pre vs. post values for the most-changed metrics")
    fig.tight_layout(rect=(0, 0.05, 1, 1))
    add_caveat(fig)
    fig.savefig(out_path, dpi=150)
    plt.close(fig)


def main():
    import sys

    csv_path = os.path.join(OUT_DIR, "pre_post_metrics.csv")

    if "--from-csv" in sys.argv and os.path.exists(csv_path):
        print(f"Reusing existing data from {csv_path}")
        df = pd.read_csv(csv_path)
    else:
        locked = load_locked_drawings()
        print(f"Locked drawings to compare: {len(locked)}")
        df = build_comparison(locked)
        if df.empty:
            print("No comparable pre/post metric pairs found.")
            return
        df.to_csv(csv_path, index=False)
        print(f"Wrote tidy metric-level data to {csv_path}")

    summary_path = os.path.join(OUT_DIR, "pre_post_effect_size_summary.png")
    summary = plot_summary(df, summary_path)
    print(f"Wrote summary chart to {summary_path}")

    top_metrics = summary.head(12).index.tolist()
    slope_path = os.path.join(OUT_DIR, "pre_post_top_metrics_slope.png")
    plot_slope_grid(df, top_metrics, slope_path)
    print(f"Wrote per-drawing detail chart to {slope_path}")

    headline_path = os.path.join(OUT_DIR, "pre_post_headline_metrics.png")
    plot_headline_metrics(df, headline_path)
    print(f"Wrote headline-metrics (DOS/Tightness) chart to {headline_path}")

    print("\nTop changed metrics (by effect size):")
    print(summary.head(12))

    dos = df[df["metric"] == "DOS"]
    if not dos.empty and dos["post"].nunique() == 1:
        print(
            f"\nWARNING: every re-run drawing got the identical DOS value "
            f"({dos['post'].iloc[0]}) regardless of input. This looks like the "
            f"current API is returning a constant/fallback result, not a real "
            f"recalculation -- treat the post-fix values as suspect until that's "
            f"confirmed with whoever owns the spiral API."
        )


if __name__ == "__main__":
    main()
