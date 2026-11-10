/**
 * DEVELOPMENT SAMPLE IMPORT FILES.
 * Real TIMB files are ENCRYPTED, with the key chosen from the file-name prefix (ELS… for bookings, EL… for stop orders).
 * These plain-text samples exist only so the import workflow can be exercised in Phase 1. They are NOT the real format
 * and parsing them is NOT equivalent to decrypting a TIMB file (UQ-13).
 */
export interface SampleFile {
  key: string;
  filename: string;
  importType: "GROWER_REGISTER" | "CREDITOR_REGISTER" | "GROWER_BOOKING" | "STOP_ORDER";
  description: string;
  content: string;
}

const NOTE = "# DEV SAMPLE FORMAT — not the real encrypted TIMB format\n";

export const SAMPLE_FILES: SampleFile[] = [
  {
    key: "booking-0917",
    filename: "ELS_ETHICAL_20260917.txt",
    importType: "GROWER_BOOKING",
    description: "Documented test day: V100060 × 3 bales and V100061 × 2 bales for 17 Sep 2026",
    content:
      NOTE +
      "booking_ref,grower_no,first_name,surname,sell_date,book_date,bales_booked\n" +
      "EL2609170001,V100060,Chengetai,Chingoma,2026-09-17,2026-09-16,3\n" +
      "EL2609170002,V100061,Trust,Gwenzi,2026-09-17,2026-09-16,2\n",
  },
  {
    key: "booking-0918-errors",
    filename: "ELS_ETHICAL_20260918.txt",
    importType: "GROWER_BOOKING",
    description: "DEMO: contains an unknown grower and a bad bale count, to show row-level errors",
    content:
      NOTE +
      "booking_ref,grower_no,first_name,surname,sell_date,book_date,bales_booked\n" +
      "EL2609180001,V100074,Farai,Ngapasare,2026-09-18,2026-09-17,4\n" +
      "EL2609180002,V999999,Unknown,Grower,2026-09-18,2026-09-17,2\n" +
      "EL2609180003,V100079,Chengetai,Zacharia,2026-09-18,2026-09-17,three\n",
  },
  {
    key: "booking-renamed",
    filename: "bookings_for_today.txt",
    importType: "GROWER_BOOKING",
    description: "DEMO: a renamed file — shows the decryption-key message (the ELS prefix selects the key)",
    content:
      NOTE +
      "booking_ref,grower_no,first_name,surname,sell_date,book_date,bales_booked\n" +
      "EL2609170001,V100060,Chengetai,Chingoma,2026-09-17,2026-09-16,3\n",
  },
  {
    key: "growers-sample",
    filename: "GROWERS_EL_SAMPLE.txt",
    importType: "GROWER_REGISTER",
    description: "DEMO: grower register update (adds two demo growers, updates one phone number)",
    content:
      NOTE +
      "grower_no,first_name,surname,district,cellphone\n" +
      "V100060,Chengetai,Chingoma,14,0771000060\n" +
      "V100150,Rudo,Mashingaidze,21,0772000150\n" +
      "V100151,Nyasha,Muzenda,9,0773000151\n",
  },
  {
    key: "creditors-sample",
    filename: "CREDITORS_EL_SAMPLE.txt",
    importType: "CREDITOR_REGISTER",
    description: "DEMO: creditor register update",
    content:
      NOTE +
      "creditor_code,creditor_name,cellphone\n" +
      "00050,Creditor 00050,0242000050\n" +
      "00061,Creditor 00061,0242000061\n",
  },
  {
    key: "stoporders-0917",
    filename: "EL_stoporders_20260917.txt",
    importType: "STOP_ORDER",
    description: "Documented test day: one TIMB stop order, V100060 → creditor 00050, $50.00",
    content:
      NOTE +
      "stop_order_no,grower_no,creditor_code,creditor_name,amount_1,amount_2,amount_3,priority,rec_type,percent\n" +
      "1,V100060,00050,Creditor 00050,50.00,0,0,1,06,0\n",
  },
  {
    key: "stoporders-bad",
    filename: "EL_stoporders_20260916.txt",
    importType: "STOP_ORDER",
    description: "DEMO: stop orders dated 16 Sep — no sale that day, so nothing is deducted on 17 Sep",
    content:
      NOTE +
      "stop_order_no,grower_no,creditor_code,creditor_name,amount_1,amount_2,amount_3,priority,rec_type,percent\n" +
      "1,V100061,00061,Creditor 00061,25.00,0,0,1,06,0\n",
  },
];

export function sampleByKey(key: string): SampleFile | undefined {
  return SAMPLE_FILES.find((s) => s.key === key);
}
