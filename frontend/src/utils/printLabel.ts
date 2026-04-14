import QRCode from "qrcode";

interface LabelData {
  title: string;
  subtitle?: string;
  uid: string;
}

/**
 * Abre una ventana emergente con la etiqueta lista para imprimir.
 * Incluye código QR generado como imagen PNG.
 */
export async function printLabel({ title, subtitle, uid }: LabelData) {
  const qrDataUrl = await QRCode.toDataURL(uid, {
    errorCorrectionLevel: "M",
    width: 200,
    margin: 2,
    color: { dark: "#000000", light: "#ffffff" },
  });

  const subtitleHtml = subtitle ? `<p class="subtitle">${subtitle}</p>` : "";

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>Etiqueta — ${title}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: Arial, sans-serif;
      background: #f0f0f0;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
    }
    .label {
      background: #fff;
      border: 1.5px solid #ccc;
      border-radius: 10px;
      padding: 18px 22px 16px;
      width: 260px;
      text-align: center;
      box-shadow: 0 3px 12px rgba(0,0,0,0.12);
    }
    .brand {
      font-size: 9px;
      color: #aaa;
      letter-spacing: 3px;
      text-transform: uppercase;
      margin-bottom: 10px;
    }
    .title {
      font-size: 16px;
      font-weight: 700;
      color: #111;
      margin-bottom: 3px;
    }
    .subtitle {
      font-size: 11px;
      color: #666;
      margin-bottom: 10px;
    }
    .qr {
      margin: 12px auto 8px;
      display: block;
      width: 160px;
      height: 160px;
    }
    .uid {
      font-size: 9px;
      color: #bbb;
      font-family: monospace;
      letter-spacing: 1px;
    }
    @media print {
      body { background: #fff; min-height: auto; }
      .label { border: 1px solid #bbb; box-shadow: none; border-radius: 6px; }
    }
  </style>
</head>
<body>
  <div class="label">
    <p class="brand">EffiGuard</p>
    <p class="title">${title}</p>
    ${subtitleHtml}
    <img class="qr" src="${qrDataUrl}" alt="QR ${uid}" />
    <p class="uid">${uid}</p>
  </div>
  <script>
    window.onload = function () {
      window.print();
      window.onafterprint = function () { window.close(); };
    };
  </script>
</body>
</html>`;

  const win = window.open("", "_blank", "width=380,height=500,menubar=no,toolbar=no");
  if (win) {
    win.document.write(html);
    win.document.close();
  }
}
