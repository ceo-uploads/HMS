# 🏥 Hospital Management System (HMS)

> A high-performance, cross-platform Hospital Management Software designed for seamless clinical test entry, doctor appointment scheduling, patient bookings, and administrative analytics.

---

## 🏗 System Architecture

```
                                  +-----------------------+
                                  |   HMS Core System     |
                                  +-----------+-----------+
                                              |
                     +------------------------+------------------------+
                     |                                                 |
         +-----------v-----------+                         +-----------v-----------+
         |   Desktop Application |                         |   Mobile Application  |
         |      (Windows)        |                         |       (Android)       |
         +-----------+-----------+                         +-----------+-----------+
         |  Rust Backend Core    |                         |  Kotlin Native App    |
         |  React.js Frontend    |                         |  Real-time Monitoring |
         +-----------------------+                         +-----------------------+
```

| Component | Stack / Technology | Platform | Focus |
| :--- | :--- | :--- | :--- |
| **Desktop Client** | **Rust** + **React.js** | Windows | Main operational dashboard, ticketing, and billing |
| **Monitoring Client** | **Kotlin** | Android (`.apk`) | Real-time system monitoring & status updates |
| **Security** | Auth Engine | System-wide | Role-based credential authentication (`Username` + `Password`) |

---

## 🔒 Security & Access Control

All system features require user authentication before access is granted.

```
 [ Login Gate ] ---> Credentials Validation (Username & Password) ---> [ Access Granted ]
```

---

## 🧩 Core Modules Overview

```
                      +---------------------------------------+
                      |         HMS Main Modules              |
                      +---+-------+-------+-------+-------+---+
                          |       |       |       |       |
                          v       v       v       v       v
                        [01]    [02]    [03]    [04]    [05]
                       Counter Appt.  Booking  Mgmt.   Archive
```

1. **`01` Counter Module** — Clinical test registration, billing calculation, report checkout, and slip generation.
2. **`02` Appointment Module** — Doctor lookup, live patient registration, and advance booking management.
3. **`03] Booking Module** — In-patient booking and emergency room handling.
4. **`04` Management Module** — Administrative controls for doctors, tests, references, and system tunnels.
5. **`05` Archive & Analytics** — Financial, clinical, and performance analytics across doctors and test referrals.

---

## 🖥 Detailed Module Breakdown

### 01. 🧪 Counter Module

#### 📊 Tabs & Functionality

##### A. Dashboard (Medical Tests)
- **Available Tests Registry:** List view displaying:
  - `Code` — Unique identifier for the test.
  - `Test Name` — Full name of the medical test.
  - `Price` — Base cost in BDT ($\text{TK}$).

##### B. Tests (Order Entry & Billing)
- **Patient Inputs:**
  - `Name` (Text)
  - `Age` (Numeric)
  - `Gender` (Dropdown: `Male` | `Female` | `Other`)
  - `Contact Number` (Mobile Number)
- **Selection Parameters:**
  - `Reference` (Multi-select searchable dropdown of Doctors)
  - `Select Test` (Multi-select searchable dropdown of clinical tests)
  - `Select Remarks` (Multi-select special reference identifiers)
  - `Delivery Date & Time` (Date + Time + Day selector)
- **Live Display Metrics:**
  - Selected Doctor Details
  - Selected Test Summary (`Code` + `Name` + `Price in TK`)
  - Remarks / Reference Code ID
  - Total Gross Price ($\text{TK}$)
  - Remark Discount ($\text{Percentage \%}$ + $\text{Deduction Amount in TK}$)
  - Net Payable ($\text{Total Price} - \text{Remark Discount}$)
- **Payment & Settlement Inputs:**
  - `Discount Price` (Optional manual override)
  - `Advance Payment` ($\text{TK}$, entering an amount automatically toggles `Full Paid` to `No`)
  - `Full Paid` Toggle (`Yes` | `No`)
  - `Extra Description` (Optional notes)
- **Dynamic Display Calculation:**
  - **Net Payable:** $\text{Gross Price} - \text{Discounts}$
  - **In Words:** Auto-generated text representation of Net Payable ($\text{TK}$)
  - **Advance Paid:** Updated advance amount ($\text{TK}$)
  - **Due Amount:** $\text{Net Payable} - \text{Advance Paid}$
  - **Bill ID:** Auto-generated unique identifier formatted as `PXXXXXXXXXX` (10-digit database-verified unique key)
- **Action:** Generate and print customer billing slip.

##### C. Checkout (Report Delivery)
- Card-based view listing test slips filtered strictly by **`Not Delivered`** status.
- **Card View Fields:**
  - `Bill ID`
  - `Test Date`
  - `Report Delivery Date & Time`
  - `Net Price (TK)`
  - `Full Paid Status` (`Yes` / `No`)
  - `Due Amount (TK)`
  - `Status` (Fixed: `Not Delivered`)
- **Card Actions:**
  - **View Details:** Toggles full printable document preview with extended status information.
  - **Checkout:** Updates delivery status from `Not Delivered` $\rightarrow$ `Delivered`.
- **Global Tools:** Multi-field search filter and sorting options (Chronological: `Ascending` / `Descending`).

##### D. Directory (All Test Records)
- Complete visual catalog of all generated test slips regardless of delivery status.
- **Card View Fields:** Same as Checkout (`Bill ID`, `Test Date`, `Delivery Date/Time`, `Net Price`, `Paid Status`, `Due Amount`, `Delivery Status`).
- **Actions & Tools:** `View Details` printable preview toggle, full-text search, and time-based sorting (`Asc` / `Desc`).

---

### 02. 📅 Appointment Module

#### 📊 Tabs & Functionality

##### A. Dashboard (Doctor Directory)
- Overview catalog of doctors available for appointments.
- **Doctor Card Attributes:**
  - Doctor Profile Image
  - Doctor Name + Unique ID
  - Professional Title & Credentials
  - Medical Specialty
  - Direct Contact Number
  - Chamber / Consultation Hours
  - Visit Fees ($\text{New Patient Rate}$ vs $\text{Returning Patient Rate}$)
  - **`Book Appointment` Button:** Triggers a popup modal allowing direct routing to **`Live-AP`** or **`Pre-AP`** with doctor data pre-loaded.

##### B. Live-AP (Immediate Walk-In Appointments)
- **Doctor Selection:** Searchable dropdown with full doctor details pre-filled.
- **Patient Input:** `Name`, `Contact Number`, `Age`, `Gender`.
- **System Automated Checks (Patient History):**
  - Searches database using `Name` or `Contact Number`.
  - Displays previous consultation logs and last visit date.
  - **Classification Logic:**
    - If history exists within 3 months $\rightarrow$ Marked as **`Old Patient`** (applies returning fee).
    - If no history exists $\rightarrow$ Marked as **`New Patient`** (generates New Patient ID + applies new fee).
    - If history exists but last visit > 3 months ago $\rightarrow$ Marked as **`Updated New`**.
- **Session Info Display:** Date (Today), Visiting Time Slot ($\text{From Time} \rightarrow \text{To Time}$), Visit Fee.
- **Action:** Print appointment token document.

##### C. Pre-AP (Advance Booking)
- **Doctor Selection:** Searchable dropdown with full doctor details.
- **Patient Input:** `Name`, `Contact Number`, `Age`, `Gender`.
- **Automated History Engine:** Runs classification checks (`New Patient`, `Old Patient`, `Updated New`).
- **Session Info Display:** Date, Time Slot, Calculated Visit Fee.
- **Action:** `Complete Booking` registration trigger.

##### D. Pre-Record & Directory
- Historical logs and search interface for past appointment records and advance reservations.

---

### 03. 🛏 Booking Module

Focuses on facility accommodations and urgent admissions:

* 🩺 **Patient Booking:** In-patient room/bed reservations and ward allocations.
* 🚨 **Emergency:** Immediate emergency admission logging and triage registration.

---

### 04. ⚙️ Management Module

Central administrative panel for managing underlying system entities:

```
 [ Management Panel ]
 ├── 🧪 Tests Management       (Add, edit, or archive clinical tests & base pricing)
 ├── 👨‍⚕️ Doctors Management     (Manage profiles, schedules, specialties & fees)
 ├── 📑 Reference Management   (Configure reference sources & commission/remark structures)
 ├── 🛏 Bookings Management    (Facility capacity, room rates & ward statuses)
 └── 🛠 Dev - Tunnel           (Developer diagnostics, system logs & API tunnel settings)
```

---

### 05. 📦 Archive & Analytics

Data visualization and analytical reporting hub:

* 📈 **Tests Analysis:** Volume, frequency, and revenue metrics across clinical tests.
* 📋 **Referrer Analysis:** Tracking performance and referral volumes by reference sources.
* 👨‍⚕️ **Doctors Analysis:** Patient load, visit revenue, and appointment distribution.
* 📊 **Analytics Page:** High-level dashboard consolidating overall hospital operations, cash flow, and trends.

---

<p align="center">
  <i>Hospital Management System — Scalable, Fast, and Secure.</i>
</p>
