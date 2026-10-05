import sys
import os
import hashlib

# Monkey-patch hashlib.md5 for Python 3.8 / OpenSSL compatibility with ReportLab
_original_md5 = hashlib.md5
def _safe_md5(*args, **kwargs):
    kwargs.pop('usedforsecurity', None)
    return _original_md5(*args, **kwargs)
hashlib.md5 = _safe_md5

try:
    import reportlab
    print("ReportLab is already installed!")
except ImportError:
    print("ReportLab is NOT installed. Attempting installation...")
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "reportlab"])
    import reportlab
    print("ReportLab installed successfully!")

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
            self.drawString(54, 11 * inch - 36, "ToolCrib Software — License Generation, Encryption & Validation Specification")
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

def build_pdf(filename="ToolCrib_License_Architecture_Specification.pdf"):
    doc = SimpleDocTemplate(
        filename,
        pagesize=letter,
        leftMargin=54,
        rightMargin=54,
        topMargin=54,
        bottomMargin=54
    )

    styles = getSampleStyleSheet()

    # Custom styles
    primary_color = colors.HexColor("#1A365D")   # Deep Navy
    secondary_color = colors.HexColor("#2B6CB0") # Slate Blue
    dark_neutral = colors.HexColor("#2D3748")    # Charcoal
    light_bg = colors.HexColor("#F7FAFC")        # Off-white
    border_color = colors.HexColor("#E2E8F0")    # Soft Gray
    accent_teal = colors.HexColor("#0D9488")     # Teal

    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=24,
        leading=28,
        textColor=primary_color,
        spaceAfter=8
    )

    subtitle_style = ParagraphStyle(
        'DocSubtitle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=12,
        leading=16,
        textColor=secondary_color,
        spaceAfter=15
    )

    h1_style = ParagraphStyle(
        'Heading1_Custom',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=16,
        leading=20,
        textColor=primary_color,
        spaceBefore=16,
        spaceAfter=10,
        keepWithNext=True
    )

    h2_style = ParagraphStyle(
        'Heading2_Custom',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=12,
        leading=16,
        textColor=secondary_color,
        spaceBefore=12,
        spaceAfter=6,
        keepWithNext=True
    )

    body_style = ParagraphStyle(
        'Body_Custom',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9.5,
        leading=14,
        textColor=dark_neutral,
        spaceAfter=8
    )

    bullet_style = ParagraphStyle(
        'Bullet_Custom',
        parent=body_style,
        leftIndent=15,
        firstLineIndent=-10,
        spaceAfter=4
    )

    code_style = ParagraphStyle(
        'Code_Custom',
        parent=styles['Normal'],
        fontName='Courier',
        fontSize=8,
        leading=11,
        textColor=colors.HexColor("#1A202C"),
        backColor=colors.HexColor("#EDF2F7"),
        borderColor=colors.HexColor("#CBD5E0"),
        borderWidth=0.5,
        borderPadding=6,
        spaceBefore=6,
        spaceAfter=8
    )

    callout_style = ParagraphStyle(
        'Callout_Text',
        parent=body_style,
        fontSize=9,
        leading=13,
        textColor=colors.HexColor("#1A365D")
    )

    story = []

    # Title Banner
    story.append(Paragraph("ToolCrib Licensing Architecture & Cryptographic Specification", title_style))
    story.append(Paragraph("Comprehensive Technical Guide to Key Generation, Encryption/Encoding, Decoding, and Multi-Layered Validation", subtitle_style))
    story.append(HRFlowable(width="100%", thickness=2, color=primary_color, spaceAfter=15))

    # Executive Summary Box
    summary_html = "<b>System Overview:</b> ToolCrib Software utilizes an enterprise-grade, asymmetric cryptographic licensing system powered by <b>Ed25519 (Edwards-curve Digital Signature Algorithm)</b>, <b>SHA-256 cryptographic hashing</b>, and <b>URL-Safe Base64 serialization</b>. This architecture ensures complete offline operation, hardware node-locking via MAC address verification, payload integrity verification, and non-forgeable signature authentication."
    summary_table = Table([[Paragraph(summary_html, callout_style)]], colWidths=[504])
    summary_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#EBF8FF")),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor("#3182CE")),
        ('TOPPADDING', (0,0), (-1,-1), 8),
        ('BOTTOMPADDING', (0,0), (-1,-1), 8),
        ('LEFTPADDING', (0,0), (-1,-1), 12),
        ('RIGHTPADDING', (0,0), (-1,-1), 12),
    ]))
    story.append(summary_table)
    story.append(Spacer(1, 14))

    # Section 1: Cryptographic Algorithms & Standards
    story.append(Paragraph("1. Core Cryptographic Algorithms & Standards", h1_style))
    story.append(Paragraph("The ToolCrib licensing module (<code>license_utils.py</code>) integrates multiple industry-standard algorithms to achieve security, offline autonomy, and tamper prevention:", body_style))

    algo_data = [
        [Paragraph("<b>Algorithm / Primitive</b>", body_style), Paragraph("<b>Standard / Spec</b>", body_style), Paragraph("<b>Role in Licensing Flow</b>", body_style)],
        [Paragraph("<b>Ed25519</b><br/>(Edwards-curve DSA)", body_style), Paragraph("RFC 8037 / Curve25519", body_style), Paragraph("Asymmetric digital signature. The vendor signs payload bytes with a 32-byte private key. The server validates using the matching public key.", body_style)],
        [Paragraph("<b>SHA-256</b><br/>(Secure Hash Standard)", body_style), Paragraph("FIPS PUB 180-4", body_style), Paragraph("Computes a 256-bit cryptographic digest over canonical base metadata claims to guarantee complete payload integrity.", body_style)],
        [Paragraph("<b>URL-Safe Base64</b><br/>(Base64URL)", body_style), Paragraph("RFC 4648 § 5", body_style), Paragraph("Encodes binary signatures and JSON byte payloads into clean ASCII strings without padding ('=') for easy transport.", body_style)],
        [Paragraph("<b>Canonical JSON</b><br/>(RFC 8785)", body_style), Paragraph("ECMAScript / RFC 8785", body_style), Paragraph("Ensures deterministic key sorting (<code>sort_keys=True</code>) and compact whitespace elimination before hashing & signing.", body_style)]
    ]
    t_algo = Table(algo_data, colWidths=[120, 110, 274])
    t_algo.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#EDF2F7")),
        ('TEXTCOLOR', (0,0), (-1,0), primary_color),
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('GRID', (0,0), (-1,-1), 0.5, border_color),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('LEFTPADDING', (0,0), (-1,-1), 8),
        ('RIGHTPADDING', (0,0), (-1,-1), 8),
    ]))
    story.append(t_algo)
    story.append(Spacer(1, 14))

    # Section 2: Key Generation Flow & Payload Architecture
    story.append(Paragraph("2. License Key Generation Flow & Architecture", h1_style))
    story.append(Paragraph("License generation occurs on the vendor side via <code>generate_license_key()</code> or the CLI tool <code>generate_license.py</code>. The flow follows a strict 7-step sequence:", body_style))

    steps = [
        "<b>Step 1 — Input Collection & MAC Normalization:</b> Accept target MAC address, customer company name, and expiration days. The MAC address is normalized to uppercase <code>XX:XX:XX:XX:XX:XX</code> format.",
        "<b>Step 2 — Base Claims Construction:</b> Construct JSON claims containing <code>customer</code>, <code>mac_address</code>, ISO-8601 UTC timestamps (<code>issued_at</code>, <code>expires_at</code>), and <code>license_version: '2.0'</code>.",
        "<b>Step 3 — SHA-256 Checksum Computation:</b> Convert base claims into canonical UTF-8 JSON bytes (sorted keys, no spaces) and derive SHA-256 checksum hex string.",
        "<b>Step 4 — Full Payload Assembly & Canonicalization:</b> Embed <code>sha256_checksum</code> into payload object and re-canonicalize into UTF-8 binary bytes.",
        "<b>Step 5 — Ed25519 Asymmetric Digital Signing:</b> Sign payload bytes using the vendor's private key (<code>Ed25519PrivateKey.sign(payload_bytes)</code>) to produce a 64-byte raw signature.",
        "<b>Step 6 — Document Packaging & Base64URL Encoding:</b> Encode payload bytes and signature bytes into URL-safe Base64 strings inside a document dictionary: <code>{'payload': ..., 'signature': ...}</code>.",
        "<b>Step 7 — Final Key Serialization:</b> Convert document dictionary to canonical JSON bytes and perform outer Base64URL encoding to produce the final license string."
    ]
    for step in steps:
        story.append(Paragraph(f"• {step}", bullet_style))

    story.append(Spacer(1, 8))
    story.append(Paragraph("<b>Payload & Signed Document Schema Structure:</b>", h2_style))
    code_schema = """// Internal Unpacked Payload Structure (JSON)
{
  "customer": "ACME Industrial Corp",
  "mac_address": "00:1A:2B:3C:4D:5E",
  "issued_at": "2026-09-24T10:00:00.000000",
  "expires_at": "2027-09-24T10:00:00.000000",
  "license_version": "2.0",
  "sha256_checksum": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
}

// Outer Signed License Container (Base64URL Enclosed)
{
  "payload": "eyJjdXN0b21lciI6ICJBQ01FIEluZHVzdHJpYWwgQ29ycCIsIC4uLn0",
  "signature": "V3ZpODNqZjI5M2ZqczI5M2pmczI5M2pmczI5M2pmczI5M2pmczI5M2pm..."
}"""
    story.append(Paragraph(code_schema, code_style))
    story.append(Spacer(1, 14))

    # Section 3: License Key Decoding ("Decrypting") & Unpacking Flow
    story.append(Paragraph("3. License Key Decoding ('Decrypting') & Unpacking", h1_style))
    story.append(Paragraph("In asymmetric signing schemes, public key licensing does not use symmetric encryption (like AES); instead, it uses <b>Asymmetric Digital Signature Packaging with URL-Safe Base64 Decoding</b>. The term 'decryption' in this architecture refers to reversing the Base64URL encoding layers and extracting verifiable claims:", body_style))

    dec_steps = [
        "<b>Outer Base64URL Decoding:</b> The license key string is stripped of whitespace and passed to <code>_decode_b64url()</code>, restoring URL padding ('=') and decoding ASCII bytes into UTF-8 JSON document string.",
        "<b>Document Parsing:</b> JSON parser extracts <code>payload</code> (Base64URL encoded string) and <code>signature</code> (Base64URL encoded signature string).",
        "<b>Payload & Signature Extraction:</b> <code>_decode_b64url(payload)</code> yields raw UTF-8 canonical JSON payload bytes. <code>_decode_b64url(signature)</code> yields 64 raw binary signature bytes.",
        "<b>Claims Deserialization:</b> JSON parser deserializes payload bytes into Python dictionary containing customer name, target MAC address, validity timestamps, and SHA-256 hash."
    ]
    for dstep in dec_steps:
        story.append(Paragraph(f"• {dstep}", bullet_style))

    story.append(Spacer(1, 14))

    # Section 4: Validation Gates & Verification Pipeline
    story.append(Paragraph("4. Multi-Tiered License Validation Pipeline", h1_style))
    story.append(Paragraph("When <code>verify_license_key()</code> is invoked by backend API endpoints (<code>/api/license/status</code>, <code>/api/license/validate</code>, <code>/api/license/activate</code>), the key must successfully pass through <b>5 consecutive security validation gates</b>:", body_style))

    val_data = [
        [Paragraph("<b>Validation Gate</b>", body_style), Paragraph("<b>Mechanism & Function</b>", body_style), Paragraph("<b>Failure Cause & Security Defense</b>", body_style)],
        [Paragraph("<b>Gate 1: Ed25519 Signature Check</b>", body_style), Paragraph("Executes <code>public_key.verify(signature_bytes, payload_bytes)</code> using vendor public key (<code>ed25519_public.b64</code>).", body_style), Paragraph("Fails if key was modified or generated without vendor private key. Rejects tampered keys immediately.", body_style)],
        [Paragraph("<b>Gate 2: SHA-256 Hash Integrity</b>", body_style), Paragraph("Recomputes SHA-256 digest on base claims and compares with <code>payload['sha256_checksum']</code>.", body_style), Paragraph("Fails if internal metadata values (e.g. expiration date or customer name) were altered. Prevents internal claim tampering.", body_style)],
        [Paragraph("<b>Gate 3: MAC Format Standard</b>", body_style), Paragraph("Evaluates MAC regex pattern <code>^([0-9A-F]{2}:){5}[0-9A-F]{2}$</code> via <code>is_valid_mac_pattern()</code>.", body_style), Paragraph("Fails if MAC address field is malformed or corrupted.", body_style)],
        [Paragraph("<b>Gate 4: Hardware Binding Match</b>", body_style), Paragraph("Queries all local host Network Interfaces (via <code>psutil</code> & <code>uuid</code>) and matches license MAC.", body_style), Paragraph("Fails if license key is copied to unauthorized hardware. Enforces host node-locking.", body_style)],
        [Paragraph("<b>Gate 5: Expiration Timestamp</b>", body_style), Paragraph("Compares system UTC clock (<code>datetime.utcnow()</code>) against ISO-8601 <code>expires_at</code> field.", body_style), Paragraph("Fails if current date exceeds expiration timestamp (unless perpetual license where <code>expires_at=None</code>).", body_style)]
    ]
    t_val = Table(val_data, colWidths=[120, 194, 190])
    t_val.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#EDF2F7")),
        ('TEXTCOLOR', (0,0), (-1,0), primary_color),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('GRID', (0,0), (-1,-1), 0.5, border_color),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('LEFTPADDING', (0,0), (-1,-1), 8),
        ('RIGHTPADDING', (0,0), (-1,-1), 8),
    ]))
    story.append(t_val)
    story.append(Spacer(1, 14))

    # Section 5: End-to-End System Workflow Architecture Diagram
    story.append(Paragraph("5. End-to-End License Lifecycle Workflow", h1_style))
    story.append(Paragraph("The complete operational lifecycle spanning Vendor Generation, Client Server Activation, and API Enforcement is summarized below:", body_style))

    flow_box_html = """<b>[VENDOR ENVIRONMENT]</b><br/>
1. Vendor runs: <code>python generate_license.py --mac "XX:XX:XX..." --company "Acme" --days 365</code><br/>
2. System loads <code>ed25519_private.b64</code> & builds canonical JSON payload + SHA-256 hash.<br/>
3. Ed25519 signature generated -> Wrapped in JSON document -> Outer Base64URL encoded string output.<br/>
<br/>
<b>[CLIENT APP SERVER / ACTIVATION API]</b><br/>
4. Admin pastes key into ToolCrib UI -> Sent to <code>POST /api/license/activate</code>.<br/>
5. Server decodes Base64URL outer layer & extracts payload + signature.<br/>
6. Public Key <code>ed25519_public.b64</code> verifies Ed25519 signature.<br/>
7. System recomputes SHA-256 hash, validates MAC address match against host NICs, and checks expiry date.<br/>
<br/>
<b>[DATABASE & SYSTEM ENFORCEMENT]</b><br/>
8. Validated key stored in <code>toolcrib.license_info</code> (sets <code>is_active='yes'</code>). Company profile registered in <code>toolcrib.companies</code>.<br/>
9. <code>GET /api/license/status</code> checks active license on app startup & routine API access."""

    t_flow = Table([[Paragraph(flow_box_html, callout_style)]], colWidths=[504])
    t_flow.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#F7FAFC")),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor("#CBD5E0")),
        ('TOPPADDING', (0,0), (-1,-1), 10),
        ('BOTTOMPADDING', (0,0), (-1,-1), 10),
        ('LEFTPADDING', (0,0), (-1,-1), 12),
        ('RIGHTPADDING', (0,0), (-1,-1), 12),
    ]))
    story.append(t_flow)
    story.append(Spacer(1, 14))

    # Section 6: Source Code File Reference & Implementation Details
    story.append(Paragraph("6. Backend Source Code Reference", h1_style))
    
    code_refs = [
        [Paragraph("<b>File Path</b>", body_style), Paragraph("<b>Primary Function / Endpoint</b>", body_style), Paragraph("<b>Responsibility</b>", body_style)],
        [Paragraph("<code>backend/license_utils.py</code>", body_style), Paragraph("<code>generate_license_key()</code><br/><code>verify_license_key()</code><br/><code>get_or_create_keypair()</code>", body_style), Paragraph("Core cryptographic library. Handles Ed25519 keypair loading, Base64URL encoding/decoding, SHA-256 hashing, signing & 5-stage verification.", body_style)],
        [Paragraph("<code>backend/generate_license.py</code>", body_style), Paragraph("CLI Interface<br/>(<code>main()</code>)", body_style), Paragraph("Standalone vendor CLI script to generate signed license keys for customers given MAC address and duration.", body_style)],
        [Paragraph("<code>backend/license_routes.py</code>", body_style), Paragraph("<code>/api/license/status</code><br/><code>/api/license/validate</code><br/><code>/api/license/activate</code>", body_style), Paragraph("FastAPI endpoints for checking software status, validating draft keys, and activating licenses into database.", body_style)],
        [Paragraph("<code>backend/models.py</code>", body_style), Paragraph("<code>LicenseInfo</code> ORM Model", body_style), Paragraph("SQLAlchemy database schema storing active/historical license keys, MACs, signatures, hashes, and validity dates.", body_style)]
    ]
    t_refs = Table(code_refs, colWidths=[130, 150, 224])
    t_refs.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#EDF2F7")),
        ('TEXTCOLOR', (0,0), (-1,0), primary_color),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('GRID', (0,0), (-1,-1), 0.5, border_color),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('LEFTPADDING', (0,0), (-1,-1), 8),
        ('RIGHTPADDING', (0,0), (-1,-1), 8),
    ]))
    story.append(t_refs)
    story.append(Spacer(1, 20))

    # Security Verification Summary Footer Box
    sec_summary_html = "<b>Security Verification Guarantee:</b> Ed25519 signature verification mathematically prevents key forgery. SHA-256 hashing prevents field modification. Host MAC binding prevents unauthorized hardware transfer. Expiration dates enforce subscription compliance. The system is 100% offline-capable and requires no external licensing server call."
    t_sec = Table([[Paragraph(sec_summary_html, callout_style)]], colWidths=[504])
    t_sec.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#F0FDF4")),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor("#16A34A")),
        ('TOPPADDING', (0,0), (-1,-1), 8),
        ('BOTTOMPADDING', (0,0), (-1,-1), 8),
        ('LEFTPADDING', (0,0), (-1,-1), 12),
        ('RIGHTPADDING', (0,0), (-1,-1), 12),
    ]))
    story.append(t_sec)

    doc.build(story, canvasmaker=NumberedCanvas)
    print(f"PDF document successfully created at: {os.path.abspath(filename)}")

if __name__ == "__main__":
    build_pdf()
