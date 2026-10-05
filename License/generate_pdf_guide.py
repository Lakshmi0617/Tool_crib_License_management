import sys
import os
import hashlib

# Monkey-patch hashlib.md5 for Python 3.8+ / OpenSSL compatibility with ReportLab
_original_md5 = hashlib.md5
def _safe_md5(*args, **kwargs):
    kwargs.pop('usedforsecurity', None)
    return _original_md5(*args, **kwargs)
hashlib.md5 = _safe_md5

import reportlab
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether, HRFlowable
)
from reportlab.pdfgen import canvas

class NumberedCanvas(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            super().showPage()
        super().save()

    def draw_page_decorations(self, page_count):
        self.saveState()
        self.setFont("Helvetica", 9)
        self.setFillColor(colors.HexColor("#4A5568"))

        # Header (pages > 1)
        if self._pageNumber > 1:
            self.drawString(54, 11 * inch - 36, "ToolCrib Software — Licensing Architecture, Hardware Fingerprint & Verification Guide")
            self.setStrokeColor(colors.HexColor("#CBD5E0"))
            self.setLineWidth(0.5)
            self.line(54, 11 * inch - 42, 8.5 * inch - 54, 11 * inch - 42)

        # Footer
        page_str = f"Page {self._pageNumber} of {page_count}"
        self.drawRightString(8.5 * inch - 54, 36, page_str)
        self.drawString(54, 36, "CONFIDENTIAL & PROPRIETARY — TOOLCRIB MANAGEMENT SYSTEM")
        self.setStrokeColor(colors.HexColor("#CBD5E0"))
        self.setLineWidth(0.5)
        self.line(54, 48, 8.5 * inch - 54, 48)

        self.restoreState()

def build_pdf():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    output_pdf = os.path.join(base_dir, "ToolCrib_License_Architecture_Guide.pdf")

    doc = SimpleDocTemplate(
        output_pdf,
        pagesize=letter,
        leftMargin=54,
        rightMargin=54,
        topMargin=54,
        bottomMargin=54
    )

    styles = getSampleStyleSheet()

    # Color Palette
    primary = colors.HexColor("#0F172A")    # Dark Slate
    secondary = colors.HexColor("#1E40AF")  # Deep Blue
    accent_blue = colors.HexColor("#2563EB")# Bright Blue
    dark_neutral = colors.HexColor("#334155")
    light_bg = colors.HexColor("#F8FAFC")
    border_color = colors.HexColor("#CBD5E1")
    code_bg = colors.HexColor("#F1F5F9")

    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=20,
        leading=24,
        textColor=primary,
        spaceAfter=6
    )

    subtitle_style = ParagraphStyle(
        'DocSubtitle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=11,
        leading=15,
        textColor=secondary,
        spaceAfter=12
    )

    h1_style = ParagraphStyle(
        'H1',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=13,
        leading=17,
        textColor=primary,
        spaceBefore=12,
        spaceAfter=8,
        keepWithNext=True
    )

    body_style = ParagraphStyle(
        'Body',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=13.5,
        textColor=dark_neutral,
        spaceAfter=8
    )

    code_style = ParagraphStyle(
        'CodeStyle',
        parent=styles['Normal'],
        fontName='Courier',
        fontSize=8,
        leading=10.5,
        textColor=colors.HexColor("#0F172A")
    )

    table_header = ParagraphStyle(
        'TableHeader',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8.5,
        leading=11,
        textColor=colors.white
    )

    table_cell = ParagraphStyle(
        'TableCell',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8,
        leading=11,
        textColor=dark_neutral
    )

    callout_text = ParagraphStyle(
        'CalloutText',
        parent=body_style,
        fontSize=8.5,
        leading=12.5,
        textColor=colors.HexColor("#1E293B")
    )

    story = []

    # Title & Header Banner
    story.append(Paragraph("ToolCrib Software", title_style))
    story.append(Paragraph("Software License Architecture, Hardware Fingerprint & Verification Guide", subtitle_style))
    story.append(HRFlowable(width="100%", thickness=1.5, color=accent_blue, spaceBefore=0, spaceAfter=12))

    # Executive Overview Box
    overview_html = (
        "<b>System Security Architecture Overview:</b><br/>"
        "ToolCrib employs a robust dual-layer license protection architecture combining <b>RSA 3072-bit asymmetric digital signatures</b>, "
        "<b>SHA-256 machine hardware fingerprinting</b>, and <b>Ed25519 Base64URL token encryption</b>. "
        "This specification explains the hardware attributes collected, the generation algorithms for Fingerprints and Signatures, "
        "and the 5-gate verification mechanism implemented across backend and frontend UI."
    )
    overview_table = Table([[Paragraph(overview_html, callout_text)]], colWidths=[7.0*inch])
    overview_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), light_bg),
        ('BOX', (0,0), (-1,-1), 1, border_color),
        ('PADDING', (0,0), (-1,-1), 8),
    ]))
    story.append(overview_table)
    story.append(Spacer(1, 10))

    # Section 1: System Hardware Attributes
    story.append(Paragraph("1. System Hardware Information Attributes", h1_style))
    story.append(Paragraph(
        "To prevent unauthorized license sharing, software copying, or virtual machine cloning, ToolCrib extracts 5 core hardware identifiers "
        "from the underlying Windows operating system environment (via WMI, CIM, and native Python system calls in <code>License/client_license.py</code>):",
        body_style
    ))

    hw_data = [
        [Paragraph("Hardware Attribute", table_header), Paragraph("Extraction Method / Command", table_header), Paragraph("Purpose & Description", table_header)],
        [
            Paragraph("<b>Primary MAC Address</b>", table_cell),
            Paragraph("<code>psutil.net_if_addrs()</code> or <code>uuid.getnode()</code>", table_cell),
            Paragraph("Primary network interface card MAC address (12-char hex, e.g. <code>0068EBBCA085</code>). Binds license to network hardware.", table_cell)
        ],
        [
            Paragraph("<b>System UUID</b>", table_cell),
            Paragraph("<code>Get-CimInstance Win32_ComputerSystemProduct .UUID</code>", table_cell),
            Paragraph("Universally Unique Identifier generated by motherboard vendor / BIOS. Highly persistent hardware identifier.", table_cell)
        ],
        [
            Paragraph("<b>Motherboard Serial</b>", table_cell),
            Paragraph("<code>Get-CimInstance Win32_BaseBoard .SerialNumber</code>", table_cell),
            Paragraph("Serial number physically etched onto main system motherboard.", table_cell)
        ],
        [
            Paragraph("<b>BIOS Serial Number</b>", table_cell),
            Paragraph("<code>Get-CimInstance Win32_BIOS .SerialNumber</code>", table_cell),
            Paragraph("System BIOS firmware serial number issued by OEM manufacturer (Dell, HP, Lenovo, etc.).", table_cell)
        ],
        [
            Paragraph("<b>Physical Disk Serials</b>", table_cell),
            Paragraph("<code>Get-CimInstance Win32_DiskDrive .SerialNumber</code>", table_cell),
            Paragraph("Sorted comma-separated list of physical hard drive / NVMe drive serial numbers.", table_cell)
        ]
    ]

    hw_table = Table(hw_data, colWidths=[1.5*inch, 2.5*inch, 3.0*inch])
    hw_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), primary),
        ('GRID', (0,0), (-1,-1), 0.5, border_color),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, light_bg]),
        ('PADDING', (0,0), (-1,-1), 5),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
    ]))
    story.append(hw_table)
    story.append(Spacer(1, 10))

    # Section 2: Hardware Fingerprint & SHA-256 Digest
    story.append(Paragraph("2. Hardware Fingerprint Formulation & Purpose", h1_style))
    story.append(Paragraph(
        "A <b>Hardware Fingerprint</b> is a unique 64-character SHA-256 hexadecimal digest that uniquely identifies the host computer. "
        "It acts as a cryptographic hardware lock.",
        body_style
    ))

    fp_steps = (
        "<b>Fingerprint Assembly Formula:</b><br/>"
        "1. Combine harvested hardware fields using vertical bar delimiters:<br/>"
        "&nbsp;&nbsp;&nbsp;&nbsp;<code>raw_string = MAC | SystemUUID | MotherboardSerial | BiosSerial | DiskSerials</code><br/>"
        "2. Convert all strings to uppercase.<br/>"
        "3. Compute SHA-256 hash: <code>hashlib.sha256(raw_string.encode('utf-8')).hexdigest().upper()</code><br/><br/>"
        "<b>Example Output Fingerprint (64 Characters):</b><br/>"
        "<code>3B9E512C69514D190FF4836F2E5C0E578B85266AFBE1714DAE42D77285536D3D</code><br/><br/>"
        "<b>Purpose & Security Role:</b><br/>"
        "• <b>Anti-Cloning Protection:</b> If an authorized user copies the database or software installation to another computer, "
        "the new host machine will produce a completely different SHA-256 fingerprint, instantly invalidating the license.<br/>"
        "• <b>Privacy-Preserving:</b> Hardware serials are hashed into a one-way digest, ensuring sensitive component serial numbers are never exposed in plain text."
    )
    fp_table = Table([[Paragraph(fp_steps, callout_text)]], colWidths=[7.0*inch])
    fp_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), light_bg),
        ('BOX', (0,0), (-1,-1), 1, border_color),
        ('PADDING', (0,0), (-1,-1), 8),
    ]))
    story.append(fp_table)
    story.append(Spacer(1, 10))

    # Section 3: RSA 3072-bit Digital Signature
    story.append(Paragraph("3. RSA Digital Signature Formulation & Purpose", h1_style))
    story.append(Paragraph(
        "While the <i>Fingerprint</i> locks the software to host hardware, the <b>RSA Digital Signature</b> locks the license terms "
        "(License ID, Product, Expiration Date, and Fingerprint) against modification or forgery.",
        body_style
    ))

    sig_steps = (
        "<b>Signature Generation Workflow (Vendor Side - <code>License/generate_license.py</code>):</b><br/>"
        "1. Build canonical data string: <code>data_to_sign = f'{license_id}|{fingerprint}|{product}|{expiry_str}'</code><br/>"
        "2. Sign string using vendor's RSA 3072-bit Private Key (PKCS1v15 padding + SHA-256 hashing).<br/>"
        "3. Encode resulting signature bytes into Base64 string.<br/><br/>"
        "<b>Signature Verification Workflow (Client Side - <code>License/client_license.py</code> & Backend):</b><br/>"
        "1. Read RSA Public Key (<code>public_key.pem</code>).<br/>"
        "2. Re-assemble canonical string <code>LicenseId|Fingerprint|Product|Expiry</code> from JSON fields.<br/>"
        "3. Call <code>public_key.verify(signature_bytes, data_bytes, padding.PKCS1v15(), hashes.SHA256())</code>.<br/><br/>"
        "<b>Purpose & Security Role:</b><br/>"
        "• <b>Tamper Prevention:</b> If a user opens <code>license_TC-10001.json</code> and changes <code>Expiry</code> from 2026 to 2035, "
        "or alters the <code>Fingerprint</code>, the RSA signature verification fails immediately because only the vendor possesses the private key.<br/>"
        "• <b>Non-Repudiation & Authenticity:</b> Proves the license was legitimately issued by ToolCrib software vendor."
    )
    sig_table = Table([[Paragraph(sig_steps, callout_text)]], colWidths=[7.0*inch])
    sig_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), light_bg),
        ('BOX', (0,0), (-1,-1), 1, border_color),
        ('PADDING', (0,0), (-1,-1), 8),
    ]))
    story.append(sig_table)
    story.append(Spacer(1, 10))

    # Section 4: License JSON Schema
    story.append(Paragraph("4. RSA License JSON Key Structure", h1_style))
    story.append(Paragraph(
        "When <code>python License/generate_license.py</code> is executed, it produces the following JSON structure containing all required activation tokens:",
        body_style
    ))

    json_code = (
        "{\n"
        '  "LicenseId": "TC-10001",\n'
        '  "Fingerprint": "3B9E512C69514D190FF4836F2E5C0E578B85266AFBE1714DAE42D77285536D3D",\n'
        '  "Product": "ToolCrib",\n'
        '  "Expiry": "2027-10-05T04:17:31.026283Z",\n'
        '  "Signature": "JecG6j6L9i89TnjUB8c6TqOVhMpDZ2FzV+dQUvSlI+nhIaJnjYpt1cPNrJo9Skx5..."\n'
        "}"
    )
    json_table = Table([[Paragraph(f"<pre>{json_code}</pre>", code_style)]], colWidths=[7.0*inch])
    json_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), code_bg),
        ('BOX', (0,0), (-1,-1), 1, border_color),
        ('PADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(json_table)
    story.append(Spacer(1, 10))

    # Page Break for Verification Gates & Activation Section
    story.append(PageBreak())

    # Section 5: The 5 Security Verification Gates
    story.append(Paragraph("5. The 5 Security Verification Gates", h1_style))
    story.append(Paragraph(
        "When a license key is submitted via the Web UI or validated by backend API endpoints (<code>/api/license/validate</code>, <code>/api/license/activate</code>), "
        "it must pass <b>5 consecutive security verification gates</b> in sequence:",
        body_style
    ))

    gates_data = [
        [Paragraph("Gate", table_header), Paragraph("Verification Check", table_header), Paragraph("Failure Reason / Security Rule", table_header)],
        [
            Paragraph("<b>Gate 1</b>", table_cell),
            Paragraph("<b>Cryptographic Signature Check</b>", table_cell),
            Paragraph("Verifies RSA / Ed25519 signature against vendor public key. Fails if key is tampered or forged.", table_cell)
        ],
        [
            Paragraph("<b>Gate 2</b>", table_cell),
            Paragraph("<b>Hardware Fingerprint Match</b>", table_cell),
            Paragraph("Computes current server hardware fingerprint & MAC addresses. Fails if license was generated for a different machine.", table_cell)
        ],
        [
            Paragraph("<b>Gate 3</b>", table_cell),
            Paragraph("<b>Expiration Date Check</b>", table_cell),
            Paragraph("Compares UTC current timestamp against <code>Expiry</code> timestamp. Fails if subscription period has ended.", table_cell)
        ],
        [
            Paragraph("<b>Gate 4</b>", table_cell),
            Paragraph("<b>SHA-256 Checksum Integrity</b>", table_cell),
            Paragraph("Re-calculates payload SHA-256 hash digest to confirm internal data structure claims match.", table_cell)
        ],
        [
            Paragraph("<b>Gate 5</b>", table_cell),
            Paragraph("<b>Database & Session Enforcer</b>", table_cell),
            Paragraph("Validates active license state in <code>toolcrib.license_info</code> database table on every authenticated API request.", table_cell)
        ]
    ]

    gates_table = Table(gates_data, colWidths=[0.8*inch, 2.4*inch, 3.8*inch])
    gates_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), secondary),
        ('GRID', (0,0), (-1,-1), 0.5, border_color),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, light_bg]),
        ('PADDING', (0,0), (-1,-1), 5),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
    ]))
    story.append(gates_table)
    story.append(Spacer(1, 10))

    # Section 6: End-to-End Activation Workflow
    story.append(Paragraph("6. End-to-End License Activation Workflow", h1_style))

    workflow_text = (
        "<b>Step 1: Machine Request File Generation (Client System)</b><br/>"
        "• Execute: <code>python License/client_license.py --request</code><br/>"
        "• Output: Generates <code>License/machine_request.txt</code> containing MAC address and 64-character SHA-256 Fingerprint.<br/><br/>"

        "<b>Step 2: License Issuance (Software Vendor)</b><br/>"
        "• Vendor runs: <code>python License/generate_license.py --request License/machine_request.txt --id TC-10001 --days 365</code><br/>"
        "• Output: Generates RSA signed <code>License/license_TC-10001.json</code>.<br/><br/>"

        "<b>Step 3: Web UI Validation & Activation (Admin User)</b><br/>"
        "• Admin opens ToolCrib Web UI (<code>http://localhost:3000</code>).<br/>"
        "• Pastes <b>entire JSON block</b> (including <code>LicenseId</code>, <code>Fingerprint</code>, <code>Product</code>, <code>Expiry</code>, <code>Signature</code>) into input field.<br/>"
        "• Clicks <b>🔍 Validate License</b> -> Calls <code>POST /api/license/validate</code>.<br/>"
        "• Clicks <b>🔑 Activate License</b> -> Calls <code>POST /api/license/activate</code>.<br/><br/>"

        "<b>Step 4: Database Storage & State Update</b><br/>"
        "• Deactivates previous licenses in <code>toolcrib.license_info</code>.<br/>"
        "• Registers company details in <code>toolcrib.companies</code>.<br/>"
        "• Writes new license record with active status, SHA-256 hash, and RSA signature."
    )

    wf_table = Table([[Paragraph(workflow_text, callout_text)]], colWidths=[7.0*inch])
    wf_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), light_bg),
        ('BOX', (0,0), (-1,-1), 1, border_color),
        ('PADDING', (0,0), (-1,-1), 8),
    ]))
    story.append(wf_table)

    doc.build(story, canvasmaker=NumberedCanvas)
    print(f"License Architecture PDF Guide built successfully at: {output_pdf}")

if __name__ == "__main__":
    build_pdf()
