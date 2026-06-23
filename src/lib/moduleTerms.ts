// Industry-aware terminology for the "fridge_only" simple module.
// The module was originally built for refrigeration (AC&R), so all of its
// labels were hardcoded to fridges. This maps them per-industry so an
// electrical / general workshop sees job-card & vehicle language instead.

export type ModuleTerms = {
  isRefrigeration: boolean;
  trackerLabel: string;       // nav item + tracker page title
  openTracker: string;        // dashboard quick action
  openInTracker: string;      // button on a vehicle card
  unitColumn: string;         // "Fridge Unit" column header
  dashboardTitle: string;
  dashboardSubtitle: string;
  viewAllVehicles: string;    // "View All Trailers" vs "View All Vehicles"
};

export function getModuleTerms(industry?: string | null): ModuleTerms {
  const isRefrigeration = (industry || "").toLowerCase() === "refrigeration";
  if (isRefrigeration) {
    return {
      isRefrigeration: true,
      trackerLabel: "Fridge Tracker",
      openTracker: "Open Fridge Tracker",
      openInTracker: "Open in Fridge Tracker",
      unitColumn: "Fridge Unit",
      dashboardTitle: "Fridge Service Dashboard",
      dashboardSubtitle: "Live service status for all fridge units",
      viewAllVehicles: "View All Trailers",
    };
  }
  return {
    isRefrigeration: false,
    trackerLabel: "Job Cards",
    openTracker: "Open Job Cards",
    openInTracker: "Open Job Cards",
    unitColumn: "Service Unit",
    dashboardTitle: "Service Dashboard",
    dashboardSubtitle: "Job cards & vehicle status",
    viewAllVehicles: "View All Vehicles",
  };
}
