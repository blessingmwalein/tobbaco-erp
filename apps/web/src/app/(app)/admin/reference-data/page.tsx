"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Button, PageHeader, Tabs, TabsContent, TabsList, TabsTrigger } from "@tobacco/ui";
import { BaleLocationsTab, SeasonsTab, SellingPointsTab, TimbGradesTab, WarehousesTab } from "@/components/admin/reference-data-tabs";
import { RequirePermission } from "@/components/page-guard";

export default function ReferenceDataPage() {
  return (
    <RequirePermission permission="admin.reference-data">
      <PageHeader
        title="Reference data"
        description="Seasons, selling points, bale locations, destination warehouses and TIMB grades — the one-time floor configuration, editable without code changes."
        actions={
          <Button asChild variant="secondary">
            <Link href="/buyers">
              Buyers & grades <ArrowUpRight />
            </Link>
          </Button>
        }
      />
      <Tabs defaultValue="seasons">
        <TabsList className="flex-wrap">
          <TabsTrigger value="seasons">Seasons</TabsTrigger>
          <TabsTrigger value="selling-points">Selling points</TabsTrigger>
          <TabsTrigger value="locations">Bale locations</TabsTrigger>
          <TabsTrigger value="warehouses">Warehouses</TabsTrigger>
          <TabsTrigger value="grades">TIMB grades / reasons</TabsTrigger>
        </TabsList>
        <TabsContent value="seasons">
          <SeasonsTab />
        </TabsContent>
        <TabsContent value="selling-points">
          <SellingPointsTab />
        </TabsContent>
        <TabsContent value="locations">
          <BaleLocationsTab />
        </TabsContent>
        <TabsContent value="warehouses">
          <WarehousesTab />
        </TabsContent>
        <TabsContent value="grades">
          <TimbGradesTab />
        </TabsContent>
      </Tabs>
    </RequirePermission>
  );
}
