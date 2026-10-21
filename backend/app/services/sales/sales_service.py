"""
Sales Analytics Service for SynChain AI.
Computes real operational KPIs, historical trends, equivalent-period YoY comparisons,
MoM growth, product and category contributions, ASP trends, and regional distributions
directly from PostgreSQL sales_transactions.
"""

from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional, Tuple
from collections import defaultdict
import dateutil.parser

from sqlalchemy.orm import Session
from sqlalchemy import func, extract, and_, or_, desc

from app.models.postgres.models import SalesTransaction
from app.schemas.sales import (
    SalesOverviewKPIs,
    MonthlyTrendPoint,
    QuarterlyTrendPoint,
    YoYComparisonPoint,
    ProductSalesContribution,
    CategorySalesPerformance,
    RegionalSalesPerformance,
    HistoricalSalesAnalysisResponse,
)


class SalesAnalyticsService:

    @classmethod
    def get_overview_kpis(
        cls,
        db: Session,
        year: Optional[int] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        category: Optional[str] = None,
        region: Optional[str] = None,
        product_id: Optional[str] = None,
    ) -> SalesOverviewKPIs:
        """
        Calculates high-level sales KPIs from real database transactions.
        Returns a clean empty state (has_data=False) if no records exist.
        """
        now_str = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")

        # Base filter
        filters = []
        if year:
            filters.append(extract("year", SalesTransaction.transaction_date) == year)
        if start_date:
            try:
                filters.append(SalesTransaction.transaction_date >= dateutil.parser.parse(start_date))
            except Exception:
                pass
        if end_date:
            try:
                filters.append(SalesTransaction.transaction_date <= dateutil.parser.parse(end_date))
            except Exception:
                pass
        if category and category.lower() != "all":
            filters.append(func.lower(SalesTransaction.product_category) == category.lower().strip())
        if region and region.lower() != "all":
            filters.append(func.lower(SalesTransaction.region) == region.lower().strip())
        if product_id and product_id.lower() != "all":
            filters.append(func.lower(SalesTransaction.product_id) == product_id.lower().strip())

        query = db.query(SalesTransaction)
        if filters:
            query = query.filter(and_(*filters))

        total_tx = query.count()
        if total_tx == 0:
            return SalesOverviewKPIs(
                total_revenue=0.0,
                total_units_sold=0,
                revenue_growth_mom=None,
                revenue_growth_yoy=None,
                average_selling_price=0.0,
                forecasted_revenue=None,
                forecast_accuracy=None,
                forecast_accuracy_metric="WAPE",
                forecast_metric_wape=None,
                forecast_metric_rmse=None,
                forecast_metric_mae=None,
                total_transactions=0,
                active_products_count=0,
                active_regions_count=0,
                data_freshness_timestamp=now_str,
                has_data=False,
            )

        # Aggregate totals
        aggregates = query.with_entities(
            func.coalesce(func.sum(SalesTransaction.net_revenue), 0),
            func.coalesce(func.sum(SalesTransaction.quantity_sold - SalesTransaction.return_quantity), 0),
            func.count(func.distinct(SalesTransaction.product_id)),
            func.count(func.distinct(SalesTransaction.region)),
            func.min(SalesTransaction.transaction_date),
            func.max(SalesTransaction.transaction_date),
        ).first()

        total_rev = round(float(aggregates[0]), 2)
        total_units = int(aggregates[1])
        active_products = int(aggregates[2])
        active_regions = int(aggregates[3])
        min_date: datetime = aggregates[4]
        max_date: datetime = aggregates[5]

        asp = round(total_rev / max(1, total_units), 2) if total_units > 0 else 0.0

        # Compute MoM growth for the last two available months in the dataset
        mom_growth: Optional[float] = None
        monthly_summary = (
            query.with_entities(
                extract("year", SalesTransaction.transaction_date).label("yr"),
                extract("month", SalesTransaction.transaction_date).label("mo"),
                func.sum(SalesTransaction.net_revenue).label("rev"),
            )
            .group_by("yr", "mo")
            .order_by(desc("yr"), desc("mo"))
            .limit(2)
            .all()
        )

        if len(monthly_summary) >= 2:
            latest_rev = float(monthly_summary[0][2])
            prev_rev = float(monthly_summary[1][2])
            if prev_rev > 0:
                mom_growth = round(((latest_rev - prev_rev) / prev_rev) * 100.0, 1)

        # Compute YoY growth comparing equivalent months between current year and prior year
        yoy_growth: Optional[float] = None
        if max_date and min_date and (max_date.year > min_date.year):
            latest_year = max_date.year
            prev_year = latest_year - 1
            # Find months available in latest year
            latest_year_months = [
                int(row[0])
                for row in db.query(extract("month", SalesTransaction.transaction_date))
                .filter(extract("year", SalesTransaction.transaction_date) == latest_year)
                .distinct()
                .all()
            ]

            if latest_year_months:
                # Sum revenue for current year in these months
                curr_ytd = db.query(func.coalesce(func.sum(SalesTransaction.net_revenue), 0)).filter(
                    extract("year", SalesTransaction.transaction_date) == latest_year,
                    extract("month", SalesTransaction.transaction_date).in_(latest_year_months),
                ).scalar()

                # Sum revenue for previous year in EXACT SAME months (equivalent period comparison)
                prev_equiv = db.query(func.coalesce(func.sum(SalesTransaction.net_revenue), 0)).filter(
                    extract("year", SalesTransaction.transaction_date) == prev_year,
                    extract("month", SalesTransaction.transaction_date).in_(latest_year_months),
                ).scalar()

                if prev_equiv and float(prev_equiv) > 0:
                    yoy_growth = round(((float(curr_ytd) - float(prev_equiv)) / float(prev_equiv)) * 100.0, 1)

        return SalesOverviewKPIs(
            total_revenue=total_rev,
            total_units_sold=total_units,
            revenue_growth_mom=mom_growth,
            revenue_growth_yoy=yoy_growth,
            average_selling_price=asp,
            forecasted_revenue=None,
            forecast_accuracy=None,
            forecast_accuracy_metric="WAPE",
            forecast_metric_wape=None,
            forecast_metric_rmse=None,
            forecast_metric_mae=None,
            total_transactions=total_tx,
            active_products_count=active_products,
            active_regions_count=active_regions,
            data_freshness_timestamp=now_str,
            has_data=True,
        )

    @classmethod
    def get_historical_analysis(
        cls,
        db: Session,
        year: Optional[int] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        category: Optional[str] = None,
        region: Optional[str] = None,
        product_id: Optional[str] = None,
    ) -> HistoricalSalesAnalysisResponse:
        """
        Generates comprehensive historical analysis with monthly/quarterly trends,
        equivalent-period YoY comparisons, product and category contributions,
        top & declining products, and regional sales distribution.
        """
        filters = []
        if year:
            filters.append(extract("year", SalesTransaction.transaction_date) == year)
        if start_date:
            try:
                filters.append(SalesTransaction.transaction_date >= dateutil.parser.parse(start_date))
            except Exception:
                pass
        if end_date:
            try:
                filters.append(SalesTransaction.transaction_date <= dateutil.parser.parse(end_date))
            except Exception:
                pass
        if category and category.lower() != "all":
            filters.append(func.lower(SalesTransaction.product_category) == category.lower().strip())
        if region and region.lower() != "all":
            filters.append(func.lower(SalesTransaction.region) == region.lower().strip())
        if product_id and product_id.lower() != "all":
            filters.append(func.lower(SalesTransaction.product_id) == product_id.lower().strip())

        query = db.query(SalesTransaction)
        if filters:
            query = query.filter(and_(*filters))

        total_tx = query.count()
        available_years = [
            int(y[0])
            for y in db.query(extract("year", SalesTransaction.transaction_date)).distinct().order_by(extract("year", SalesTransaction.transaction_date)).all()
            if y[0] is not None
        ]
        available_categories = [
            c[0] for c in db.query(SalesTransaction.product_category).distinct().order_by(SalesTransaction.product_category).all() if c[0]
        ]
        available_regions = [
            r[0] for r in db.query(SalesTransaction.region).distinct().order_by(SalesTransaction.region).all() if r[0]
        ]

        if total_tx == 0:
            empty_kpis = SalesOverviewKPIs(
                total_revenue=0.0,
                total_units_sold=0,
                average_selling_price=0.0,
                total_transactions=0,
                active_products_count=0,
                active_regions_count=0,
                data_freshness_timestamp=datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC"),
                has_data=False,
            )
            return HistoricalSalesAnalysisResponse(
                has_data=False,
                kpis=empty_kpis,
                monthly_trends=[],
                quarterly_trends=[],
                yoy_comparison=[],
                product_contributions=[],
                top_selling_products=[],
                declining_products=[],
                category_performance=[],
                regional_performance=[],
                available_years=available_years,
                available_categories=available_categories,
                available_regions=available_regions,
                date_range_applied={"year": year, "start_date": start_date, "end_date": end_date},
            )

        kpis = cls.get_overview_kpis(db, year, start_date, end_date, category, region, product_id)

        # 1. Monthly Trends
        monthly_raw = (
            query.with_entities(
                extract("year", SalesTransaction.transaction_date).label("yr"),
                extract("month", SalesTransaction.transaction_date).label("mo"),
                func.sum(SalesTransaction.net_revenue).label("net_rev"),
                func.sum(SalesTransaction.gross_revenue).label("gross_rev"),
                func.sum(SalesTransaction.quantity_sold - SalesTransaction.return_quantity).label("units"),
                func.count(SalesTransaction.id).label("tx_count"),
            )
            .group_by("yr", "mo")
            .order_by("yr", "mo")
            .all()
        )

        monthly_trends: List[MonthlyTrendPoint] = []
        prev_mo_rev: Optional[float] = None
        for row in monthly_raw:
            yr = int(row[0])
            mo = int(row[1])
            net_rev = round(float(row[2]), 2)
            gross_rev = round(float(row[3]), 2)
            units = max(0, int(row[4]))
            tx_count = int(row[5])
            asp = round(net_rev / max(1, units), 2)

            mom_pct = None
            if prev_mo_rev is not None and prev_mo_rev > 0:
                mom_pct = round(((net_rev - prev_mo_rev) / prev_mo_rev) * 100.0, 1)
            prev_mo_rev = net_rev

            ym_str = f"{yr}-{mo:02d}"
            monthly_trends.append(
                MonthlyTrendPoint(
                    year_month=ym_str,
                    year=yr,
                    month=mo,
                    revenue=net_rev,
                    gross_revenue=gross_rev,
                    units_sold=units,
                    asp=asp,
                    transaction_count=tx_count,
                    mom_growth_pct=mom_pct,
                )
            )

        # 2. Quarterly Trends
        quarterly_raw = (
            query.with_entities(
                extract("year", SalesTransaction.transaction_date).label("yr"),
                extract("quarter", SalesTransaction.transaction_date).label("qtr"),
                func.sum(SalesTransaction.net_revenue).label("net_rev"),
                func.sum(SalesTransaction.quantity_sold - SalesTransaction.return_quantity).label("units"),
            )
            .group_by("yr", "qtr")
            .order_by("yr", "qtr")
            .all()
        )

        quarterly_trends: List[QuarterlyTrendPoint] = []
        prev_qtr_rev: Optional[float] = None
        for row in quarterly_raw:
            yr = int(row[0])
            qtr = int(row[1])
            rev = round(float(row[2]), 2)
            units = max(0, int(row[3]))
            asp = round(rev / max(1, units), 2)

            qoq_pct = None
            if prev_qtr_rev is not None and prev_qtr_rev > 0:
                qoq_pct = round(((rev - prev_qtr_rev) / prev_qtr_rev) * 100.0, 1)
            prev_qtr_rev = rev

            quarterly_trends.append(
                QuarterlyTrendPoint(
                    year_quarter=f"{yr} Q{qtr}",
                    year=yr,
                    quarter=qtr,
                    revenue=rev,
                    units_sold=units,
                    asp=asp,
                    qoq_growth_pct=qoq_pct,
                )
            )

        # 3. Year-over-Year Equivalent Period Comparison
        yoy_comparison: List[YoYComparisonPoint] = []
        if len(available_years) >= 2:
            latest_yr = available_years[-1]
            prior_yr = available_years[-2]

            # Compare month by month for equivalent months available in latest year
            latest_months = {
                m.month: m.revenue
                for m in monthly_trends
                if m.year == latest_yr
            }

            prior_months_raw = (
                db.query(
                    extract("month", SalesTransaction.transaction_date).label("mo"),
                    func.sum(SalesTransaction.net_revenue).label("rev"),
                )
                .filter(extract("year", SalesTransaction.transaction_date) == prior_yr)
                .group_by("mo")
                .all()
            )
            prior_months = {int(r[0]): float(r[1]) for r in prior_months_raw}

            month_names = [
                "Jan", "Feb", "Mar", "Apr", "May", "Jun",
                "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
            ]

            for mo in sorted(latest_months.keys()):
                curr_val = latest_months[mo]
                prior_val = prior_months.get(mo, 0.0)
                g_pct = None
                if prior_val > 0:
                    g_pct = round(((curr_val - prior_val) / prior_val) * 100.0, 1)

                yoy_comparison.append(
                    YoYComparisonPoint(
                        period=f"{month_names[mo-1]}",
                        current_year=latest_yr,
                        previous_year=prior_yr,
                        current_year_revenue=round(curr_val, 2),
                        previous_year_revenue=round(prior_val, 2),
                        growth_pct=g_pct,
                        is_equivalent_period=True,
                    )
                )

        # 4. Product-wise Revenue Contribution & Performance
        total_rev = max(0.01, kpis.total_revenue)
        product_raw = (
            query.with_entities(
                SalesTransaction.product_id,
                SalesTransaction.product_name,
                SalesTransaction.product_category,
                func.sum(SalesTransaction.net_revenue).label("rev"),
                func.sum(SalesTransaction.quantity_sold - SalesTransaction.return_quantity).label("units"),
            )
            .group_by(
                SalesTransaction.product_id,
                SalesTransaction.product_name,
                SalesTransaction.product_category,
            )
            .order_by(desc("rev"))
            .all()
        )

        product_contributions: List[ProductSalesContribution] = []
        for r in product_raw:
            pid = str(r[0])
            pname = str(r[1])
            pcat = str(r[2])
            rev = round(float(r[3]), 2)
            units = max(0, int(r[4]))
            asp = round(rev / max(1, units), 2)
            share = round((rev / total_rev) * 100.0, 2)

            # Trend direction: check first half vs second half of transactions for this product
            tx_dates = db.query(SalesTransaction.transaction_date, SalesTransaction.net_revenue).filter(
                SalesTransaction.product_id == pid
            ).order_by(SalesTransaction.transaction_date).all()

            trend_dir = "stable"
            growth_pct = None
            if len(tx_dates) >= 4:
                half = len(tx_dates) // 2
                h1_rev = sum(float(t[1]) for t in tx_dates[:half])
                h2_rev = sum(float(t[1]) for t in tx_dates[half:])
                if h1_rev > 0:
                    growth_pct = round(((h2_rev - h1_rev) / h1_rev) * 100.0, 1)
                    if growth_pct > 10.0:
                        trend_dir = "growing"
                    elif growth_pct < -10.0:
                        trend_dir = "declining"

            product_contributions.append(
                ProductSalesContribution(
                    product_id=pid,
                    product_name=pname,
                    category=pcat,
                    units_sold=units,
                    total_revenue=rev,
                    asp=asp,
                    revenue_share_pct=share,
                    trend_direction=trend_dir,
                    growth_pct=growth_pct,
                )
            )

        top_selling = sorted(product_contributions, key=lambda x: x.total_revenue, reverse=True)[:5]
        declining = [p for p in product_contributions if p.trend_direction == "declining"]
        declining = sorted(declining, key=lambda x: x.growth_pct or 0.0)[:5]

        # 5. Category-wise Performance
        cat_raw = (
            query.with_entities(
                SalesTransaction.product_category,
                func.sum(SalesTransaction.net_revenue).label("rev"),
                func.sum(SalesTransaction.quantity_sold - SalesTransaction.return_quantity).label("units"),
                func.count(func.distinct(SalesTransaction.product_id)).label("p_count"),
            )
            .group_by(SalesTransaction.product_category)
            .order_by(desc("rev"))
            .all()
        )

        category_perf: List[CategorySalesPerformance] = []
        for r in cat_raw:
            cat_name = str(r[0])
            rev = round(float(r[1]), 2)
            units = max(0, int(r[2]))
            pcount = int(r[3])
            share = round((rev / total_rev) * 100.0, 2)
            asp = round(rev / max(1, units), 2)

            category_perf.append(
                CategorySalesPerformance(
                    category=cat_name,
                    revenue=rev,
                    units_sold=units,
                    revenue_share_pct=share,
                    product_count=pcount,
                    asp=asp,
                )
            )

        # 6. Regional Performance
        region_raw = (
            query.with_entities(
                SalesTransaction.region,
                func.sum(SalesTransaction.net_revenue).label("rev"),
                func.sum(SalesTransaction.quantity_sold - SalesTransaction.return_quantity).label("units"),
                func.count(SalesTransaction.id).label("tx_count"),
            )
            .group_by(SalesTransaction.region)
            .order_by(desc("rev"))
            .all()
        )

        regional_perf: List[RegionalSalesPerformance] = []
        for r in region_raw:
            reg_name = str(r[0])
            rev = round(float(r[1]), 2)
            units = max(0, int(r[2]))
            tx_cnt = int(r[3])
            share = round((rev / total_rev) * 100.0, 2)
            asp = round(rev / max(1, units), 2)

            regional_perf.append(
                RegionalSalesPerformance(
                    region=reg_name,
                    revenue=rev,
                    units_sold=units,
                    revenue_share_pct=share,
                    transaction_count=tx_cnt,
                    asp=asp,
                )
            )

        return HistoricalSalesAnalysisResponse(
            has_data=True,
            kpis=kpis,
            monthly_trends=monthly_trends,
            quarterly_trends=quarterly_trends,
            yoy_comparison=yoy_comparison,
            product_contributions=product_contributions,
            top_selling_products=top_selling,
            declining_products=declining,
            category_performance=category_perf,
            regional_performance=regional_perf,
            available_years=available_years,
            available_categories=available_categories,
            available_regions=available_regions,
            date_range_applied={"year": year, "start_date": start_date, "end_date": end_date},
        )
