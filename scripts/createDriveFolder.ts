const accessToken = "ya29.A0AUMWg_LwmOdqkgDSI6xftpW11rp7139jZm-P2Hm8q8rhM4IIf8JktcKr-lc_e-3Gp1Ywkg5xblTMOipNURbhhH3KMcKuGGx-nifFiefG55NDmql0ZhH530GpLusxqRHFF057s-f6vTaNs0NjI5husN8vweDa25fiyAPhsH7cGTBWN5zWeMmGUUXK5hZ17nTwkUEt2ACA3dl1PkGl0033dWQa3-AMjHKE7psaHWql6anq2Ah-j_l3rMURtaSmfsXRfJB8TBdyjQFQwXq4WMcEX0z9hoUmaCgYKAUUSARYSFQHGX2MiFExDGIgweZyIIJ9KyC72UA0291";

const folderName = `Test Folder ${new Date().toISOString()}`;

const res = await fetch("https://www.googleapis.com/drive/v3/files", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    name: folderName,
    mimeType: "application/vnd.google-apps.folder",
    description: "Created by test script",
  }),
});

if (!res.ok) {
  const err = await res.text();
  throw new Error(`Drive API error: ${res.status} ${err}`);
}

const data = await res.json();
console.log("Created folder:", { id: data.id, name: data.name });

