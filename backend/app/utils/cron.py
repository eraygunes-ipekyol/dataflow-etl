"""
Cron ifade yardimcilari.

Standart cron day-of-week (0=Pazar, 6=Cumartesi)
APScheduler day_of_week (0=Pazartesi, 6=Pazar)
"""
from __future__ import annotations

import re


def _convert_single_dow(val: str) -> str:
    """Tek bir sayi degerini standart cron -> APScheduler'a donusturur.
    Standart: 0=Sun 1=Mon 2=Tue 3=Wed 4=Thu 5=Fri 6=Sat
    APScheduler: 0=Mon 1=Tue 2=Wed 3=Thu 4=Fri 5=Sat 6=Sun
    """
    try:
        n = int(val)
        # (n - 1) % 7  =>  0(Sun)->6, 1(Mon)->0, 5(Fri)->4, 6(Sat)->5
        return str((n - 1) % 7)
    except ValueError:
        # Isim formatinda ise (mon, tue, fri vb.) APScheduler zaten kabul eder
        return val


def cron_dow_to_apscheduler(day_of_week: str) -> str:
    """Standart cron day-of-week alanini APScheduler formatina donusturur.

    Desteklenen formatlar:
      - '*'            -> '*'
      - '5'            -> '4'       (Cuma)
      - '1-5'          -> '0-4'     (Pzt-Cum)
      - '0,6'          -> '6,5'     (Paz,Cmt)
      - '1,3,5'        -> '0,2,4'   (Pzt,Car,Cum)
      - '*/2'          -> '*/2'     (step ifadesi - oldugu gibi birak)
    """
    day_of_week = day_of_week.strip()

    # Wildcard veya step — dogrudan gec
    if day_of_week == '*':
        return '*'

    # Step ifadesi: */2 gibi — APScheduler ayni sekilde yorumlar
    if '/' in day_of_week:
        # Ornegin: */2, 1-5/2
        base, step = day_of_week.split('/', 1)
        if base == '*':
            return day_of_week  # */n oldugu gibi kalir
        # range/step: 1-5/2 -> 0-4/2
        converted_base = cron_dow_to_apscheduler(base)
        return f"{converted_base}/{step}"

    # Virgul ile ayrilan liste: 1,3,5
    if ',' in day_of_week:
        parts = day_of_week.split(',')
        converted = [_convert_single_dow(p.strip()) for p in parts]
        return ','.join(converted)

    # Range: 1-5
    if '-' in day_of_week:
        start, end = day_of_week.split('-', 1)
        return f"{_convert_single_dow(start.strip())}-{_convert_single_dow(end.strip())}"

    # Tek deger
    return _convert_single_dow(day_of_week)
