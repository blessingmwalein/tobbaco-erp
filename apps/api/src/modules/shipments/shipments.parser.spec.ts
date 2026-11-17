import { parseShipmentJson } from "./shipments.parser";

describe("parseShipmentJson", () => {
  it("parses the LeafLogix shipment structure", () => {
    const result = parseShipmentJson(JSON.stringify({
      format: "leaflogix-shipment",
      version: 1,
      source_shipment_id: 45,
      shipment: { destination: "ILT GlenEagles", vehicle: "ADG 7882", driver: "Drez Den" },
      bales: [{ barcode: "760657431$", mass: "122.00", grade: "L3OK", lot: 4 }],
    }));

    expect(result.issues).toEqual([]);
    expect(result.rows).toEqual([{ rowNumber: 1, barcode: "760657431$", massKg: "122.00" }]);
    expect(result.metadata.source_shipment_id).toBe(45);
  });

  it("rejects a document with the wrong format", () => {
    expect(() => parseShipmentJson(JSON.stringify({ format: "other", bales: [] }))).toThrow("leaflogix-shipment");
  });
});
