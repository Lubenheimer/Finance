from . import csv_ing, csv_sparkasse, csv_c24

PROFILES = {
    "ing": csv_ing,
    "sparkasse": csv_sparkasse,
    "c24": csv_c24,
}
