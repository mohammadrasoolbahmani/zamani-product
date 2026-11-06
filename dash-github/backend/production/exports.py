"""Excel export for the ZAMANI BURGER production report."""

from io import BytesIO

import jdatetime
from django.utils import timezone
from openpyxl import Workbook
from openpyxl.chart import BarChart, Reference
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter

from .models import ProductionRecord, product_type_q
from .services import get_report_summary

BRAND_RED = "C91C1C"
DARK = "1E1E1E"
LIGHT_ROW = "F7F7F7"
BORDER_COLOR = "D9D9D9"
PERSIAN_MONTHS = [
    "فروردین",
    "اردیبهشت",
    "خرداد",
    "تیر",
    "مرداد",
    "شهریور",
    "مهر",
    "آبان",
    "آذر",
    "دی",
    "بهمن",
    "اسفند",
]
PERSIAN_DIGITS = str.maketrans("0123456789", "۰۱۲۳۴۵۶۷۸۹")
THIN_BORDER = Border(
    left=Side(style="thin", color=BORDER_COLOR),
    right=Side(style="thin", color=BORDER_COLOR),
    top=Side(style="thin", color=BORDER_COLOR),
    bottom=Side(style="thin", color=BORDER_COLOR),
)


def _fa_digits(value) -> str:
    return str(value).translate(PERSIAN_DIGITS)


def _jalali(value) -> jdatetime.date:
    return jdatetime.date.fromgregorian(date=value)


def jalali_numeric(value) -> str:
    jalali = _jalali(value)
    return _fa_digits(f"{jalali.year}/{jalali.month:02d}/{jalali.day:02d}")


def jalali_long(value) -> str:
    jalali = _jalali(value)
    return f"{_fa_digits(jalali.day)} {PERSIAN_MONTHS[jalali.month - 1]} {_fa_digits(jalali.year)}"


def _safe_text(value) -> str:
    text = str(value or "")
    if text[:1] in {"=", "+", "-", "@"}:
        return f"'{text}"
    return text


def _title(ws, text: str, max_column: int, row: int = 1):
    ws.merge_cells(start_row=row, start_column=1, end_row=row, end_column=max_column)
    cell = ws.cell(row=row, column=1, value=text)
    cell.font = Font(name="Tahoma", size=16, bold=True, color="FFFFFF")
    cell.fill = PatternFill("solid", fgColor=BRAND_RED)
    cell.alignment = Alignment(horizontal="center", vertical="center")
    ws.row_dimensions[row].height = 34


def _header_row(ws, row: int, headers: list[str]):
    for column, header in enumerate(headers, start=1):
        cell = ws.cell(row=row, column=column, value=header)
        cell.font = Font(name="Tahoma", size=10, bold=True, color="FFFFFF")
        cell.fill = PatternFill("solid", fgColor=DARK)
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        cell.border = THIN_BORDER
    ws.row_dimensions[row].height = 30


def _data_row(ws, row: int, values: list, number_formats: dict[int, str] | None = None):
    for column, value in enumerate(values, start=1):
        cell = ws.cell(row=row, column=column, value=value)
        cell.font = Font(name="Tahoma", size=10)
        cell.alignment = Alignment(
            horizontal="right" if isinstance(value, str) else "center",
            vertical="center",
        )
        cell.border = THIN_BORDER
        if row % 2 == 0:
            cell.fill = PatternFill("solid", fgColor=LIGHT_ROW)
        if number_formats and column in number_formats:
            cell.number_format = number_formats[column]


def _widths(ws, widths: list[int]):
    for index, width in enumerate(widths, start=1):
        ws.column_dimensions[get_column_letter(index)].width = width


def _base_sheet(ws, title: str, max_column: int, widths: list[int], tab_color=BRAND_RED):
    ws.sheet_view.rightToLeft = True
    ws.sheet_view.showGridLines = False
    ws.sheet_properties.tabColor = tab_color
    _title(ws, title, max_column)
    _widths(ws, widths)


def _add_bar_chart(ws, sheet_title: str, category_col: int, data_col: int, rows: int, anchor: str):
    chart = BarChart()
    chart.type = "bar"
    chart.style = 10
    chart.title = sheet_title
    chart.y_axis.title = "کیلوگرم"
    data = Reference(ws, min_col=data_col, min_row=3, max_row=rows + 3)
    categories = Reference(ws, min_col=category_col, min_row=4, max_row=rows + 3)
    chart.add_data(data, titles_from_data=True)
    chart.set_categories(categories)
    chart.height = 8
    chart.width = 16
    ws.add_chart(chart, anchor)


def build_report_workbook(start, end, product_type=None) -> BytesIO:
    """Return a styled, RTL Excel workbook for the selected production period."""
    report = get_report_summary(start, end, product_type=product_type)
    totals = report["totals"]
    total_amount = totals["amount_kg"] or 1
    type_label = {
        "60": "محصولات ۶۰ درصد",
        "90": "محصولات ۹۰ درصد",
    }.get(str(product_type or "").strip(), "همه محصولات")

    wb = Workbook()
    wb.properties.creator = "ZAMANI BURGER"
    wb.properties.title = "ZAMANI BURGER Production Report"
    wb.properties.subject = "گزارش تولید"

    # --- Summary -------------------------------------------------------
    ws = wb.active
    ws.title = "خلاصه"
    _base_sheet(ws, "ZAMANI BURGER — گزارش تولید", 4, [30, 24, 22, 40])
    ws.merge_cells("A2:D2")
    ws["A2"] = "گزارش عملکرد تولید در بازه انتخاب‌شده"
    ws["A2"].font = Font(name="Tahoma", size=11, color="555555")
    ws["A2"].alignment = Alignment(horizontal="center", vertical="center")

    meta = [
        ("از تاریخ", jalali_long(start), "تا تاریخ", jalali_long(end)),
        (
            "تعداد روزها",
            _fa_digits(report["days"]),
            "تاریخ تولید فایل",
            jalali_long(timezone.localdate()),
        ),
        ("نوع محصول", type_label, "گزارش", "ZAMANI BURGER"),
    ]
    for row_index, row in enumerate(meta, start=4):
        for column, value in enumerate(row, start=1):
            cell = ws.cell(row=row_index, column=column, value=value)
            cell.font = Font(
                name="Tahoma",
                size=10,
                bold=column % 2 == 1,
                color="666666" if column % 2 else "222222",
            )
            cell.alignment = Alignment(horizontal="right", vertical="center")
            cell.fill = PatternFill("solid", fgColor="F2F2F2")
            cell.border = THIN_BORDER
        ws.row_dimensions[row_index].height = 24

    _header_row(ws, 7, ["شاخص", "مقدار", "واحد", "توضیح"])
    summary_rows = [
        ("وزن گوشت تحویل داده شده", totals["delivered_meat_kg"], "کیلوگرم", "مجموع گوشت تحویلی"),
        ("وزن گوشت تولید شده", totals["amount_kg"], "کیلوگرم", "مجموع تولید نهایی"),
        ("وزن معدومی‌ها", totals["waste_kg"], "کیلوگرم", "مجموع معدومی ثبت‌شده"),
        ("وزن ضایعات", totals.get("scrap_kg", 0), "کیلوگرم", "مجموع ضایعات ثبت‌شده"),
        ("تعداد بسته‌های تولید شده", totals["packages_count"], "بسته", "مجموع بسته‌بندی"),
        ("تعداد سوابق", totals["records_count"], "سابقه", "تعداد ردیف‌های ثبت تولید"),
        ("تعداد محصولات", totals["products_count"], "محصول", "محصولات دارای تولید در بازه"),
        ("میانگین تولید روزانه", totals["daily_average_kg"], "کیلوگرم در روز", "بر مبنای روزهای تقویمی"),
    ]
    for index, values in enumerate(summary_rows, start=8):
        _data_row(ws, index, list(values), {2: "#,##0.00"})
        ws.row_dimensions[index].height = 23

    footer_row = 8 + len(summary_rows) + 1
    ws.merge_cells(start_row=footer_row, start_column=1, end_row=footer_row, end_column=4)
    ws.cell(
        row=footer_row,
        column=1,
        value="این گزارش به‌صورت خودکار از سامانه ZAMANI BURGER تولید شده است.",
    ).font = Font(name="Tahoma", size=9, italic=True, color="777777")
    ws.cell(
        row=footer_row, column=1
    ).alignment = Alignment(horizontal="center", vertical="center")
    ws.freeze_panes = "A8"

    # --- Product performance ------------------------------------------
    ws_products = wb.create_sheet("عملکرد محصولات")
    _base_sheet(
        ws_products,
        "عملکرد محصولات",
        9,
        [7, 27, 17, 17, 15, 15, 12, 12, 13],
        "1976D2",
    )
    _header_row(
        ws_products,
        3,
        [
            "ردیف",
            "محصول",
            "تحویل (کیلوگرم)",
            "تولید (کیلوگرم)",
            "معدومی (کیلوگرم)",
            "ضایعات (کیلوگرم)",
            "تعداد بسته",
            "تعداد سابقه",
            "سهم از تولید",
        ],
    )
    products = report["by_product"]
    for index, product in enumerate(products, start=1):
        _data_row(
            ws_products,
            index + 3,
            [
                _fa_digits(index),
                _safe_text(product["name"]),
                product["delivered_meat_kg"],
                product["amount_kg"],
                product["waste_kg"],
                product.get("scrap_kg", 0),
                product["packages_count"],
                product["records_count"],
                product["amount_kg"] / total_amount,
            ],
            {
                3: "#,##0.00",
                4: "#,##0.00",
                5: "#,##0.00",
                6: "#,##0.00",
                7: "#,##0",
                8: "#,##0",
                9: "0.0%",
            },
        )
    if products:
        total_row = len(products) + 4
        _data_row(
            ws_products,
            total_row,
            [
                "",
                "مجموع",
                totals["delivered_meat_kg"],
                totals["amount_kg"],
                totals["waste_kg"],
                totals.get("scrap_kg", 0),
                totals["packages_count"],
                totals["records_count"],
                1,
            ],
            {
                3: "#,##0.00",
                4: "#,##0.00",
                5: "#,##0.00",
                6: "#,##0.00",
                7: "#,##0",
                8: "#,##0",
                9: "0.0%",
            },
        )
        for cell in ws_products[total_row]:
            cell.font = Font(name="Tahoma", size=10, bold=True)
            cell.fill = PatternFill("solid", fgColor="FCE8E8")
        _add_bar_chart(
            ws_products,
            "تولید محصولات (کیلوگرم)",
            2,
            4,
            len(products),
            "K3",
        )
    ws_products.freeze_panes = "A4"
    if products:
        ws_products.auto_filter.ref = f"A3:I{len(products) + 3}"

    # --- Producer performance -----------------------------------------
    ws_producers = wb.create_sheet("تولیدکنندگان")
    _base_sheet(
        ws_producers,
        "عملکرد تولیدکنندگان",
        9,
        [7, 22, 20, 17, 17, 15, 15, 12, 13],
        "7B1FA2",
    )
    _header_row(
        ws_producers,
        3,
        [
            "ردیف",
            "تولیدکننده",
            "سمت",
            "تحویل (کیلوگرم)",
            "تولید (کیلوگرم)",
            "معدومی (کیلوگرم)",
            "ضایعات (کیلوگرم)",
            "تعداد بسته",
            "سهم از تولید",
        ],
    )
    producers = report["by_producer"]
    for index, producer in enumerate(producers, start=1):
        _data_row(
            ws_producers,
            index + 3,
            [
                _fa_digits(index),
                _safe_text(producer["name"]),
                _safe_text(producer["role"]),
                producer["delivered_meat_kg"],
                producer["amount_kg"],
                producer["waste_kg"],
                producer.get("scrap_kg", 0),
                producer["packages_count"],
                producer["amount_kg"] / total_amount,
            ],
            {
                4: "#,##0.00",
                5: "#,##0.00",
                6: "#,##0.00",
                7: "#,##0.00",
                8: "#,##0",
                9: "0.0%",
            },
        )
    if producers:
        total_row = len(producers) + 4
        _data_row(
            ws_producers,
            total_row,
            [
                "",
                "مجموع",
                "",
                totals["delivered_meat_kg"],
                totals["amount_kg"],
                totals["waste_kg"],
                totals.get("scrap_kg", 0),
                totals["packages_count"],
                1,
            ],
            {
                4: "#,##0.00",
                5: "#,##0.00",
                6: "#,##0.00",
                7: "#,##0.00",
                8: "#,##0",
                9: "0.0%",
            },
        )
        for cell in ws_producers[total_row]:
            cell.font = Font(name="Tahoma", size=10, bold=True)
            cell.fill = PatternFill("solid", fgColor="FCE8E8")
        _add_bar_chart(
            ws_producers,
            "تولید تولیدکنندگان (کیلوگرم)",
            2,
            5,
            len(producers),
            "K3",
        )
    ws_producers.freeze_panes = "A4"
    if producers:
        ws_producers.auto_filter.ref = f"A3:I{len(producers) + 3}"

    # --- Detailed records ---------------------------------------------
    ws_details = wb.create_sheet("ریز تولید")
    _base_sheet(
        ws_details,
        "ریز سوابق تولید",
        12,
        [7, 14, 22, 25, 15, 15, 12, 15, 15, 30, 20, 15],
        "2E7D32",
    )
    _header_row(
        ws_details,
        3,
        [
            "ردیف",
            "تاریخ شمسی",
            "تولیدکننده",
            "محصول",
            "تحویل (کیلوگرم)",
            "تولید (کیلوگرم)",
            "تعداد بسته",
            "معدومی (کیلوگرم)",
            "ضایعات (کیلوگرم)",
            "یادداشت",
            "ثبت‌کننده",
            "زمان ثبت",
        ],
    )
    records = (
        ProductionRecord.objects.filter(
            product_type_q(product_type),
            date__range=(start, end),
        )
        .select_related("producer", "product", "created_by")
        .order_by("date", "created_at", "id")
    )
    for index, record in enumerate(records, start=1):
        created_at = timezone.localtime(record.created_at)
        _data_row(
            ws_details,
            index + 3,
            [
                _fa_digits(index),
                jalali_numeric(record.date),
                _safe_text(record.producer.name),
                _safe_text(record.product.name),
                float(record.delivered_meat_kg or 0),
                float(record.amount_kg or 0),
                record.packages_count,
                float(record.waste_kg or 0),
                float(record.scrap_kg or 0),
                _safe_text(record.note),
                _safe_text(
                    record.created_by.get_full_name().strip() or record.created_by.username
                ),
                _fa_digits(created_at.strftime("%H:%M")),
            ],
            {5: "#,##0.00", 6: "#,##0.00", 7: "#,##0", 8: "#,##0.00", 9: "#,##0.00"},
        )
    last_row = max(3, len(records) + 3)
    ws_details.auto_filter.ref = f"A3:L{last_row}"
    ws_details.freeze_panes = "A4"

    buffer = BytesIO()
    wb.save(buffer)
    buffer.seek(0)
    return buffer
