# Hospital Management Software

## Architecture
- **Windows Application:** Rust & React.js
- **Monitoring Android APK:** Kotlin

## Requirements
- **Authentication:** Username + Password

---

## System Contents & Modules

1. **Counter**
2. **Appointment**
3. **Booking**
4. **Management**
5. **Archive**

---

### (01) Counter

#### ~ Dashboard (Dashboard For Medical Tests)
- **List Of Clinical Test Available with:**
  - Code
  - Test Name
  - Price

#### ~ Tests
- **Inputs:**
  - Name (Character)
  - Age (Number)
  - Gender (Select: Male / Female / Other)
  - Contact Number (Mobile Number)
- **Select:**
  - Reference (Search & Select = Doctors from the dropdown List + Can be selected Multiple)
  - Select Test (Search & Select = Tests from the dropdown List + Can be selected Multiple)
  - Select Remarks (Search & Select = Special Reference from the List + Can be Selected Multiple)
  - Select Delivery Date & Time (Easy to select = Date + time + Day)
- **Display:**
  - Selected Doctors Details
  - Selected Test Details (Code + Test Name + Price in TK)
  - Remark (Special Reference Code/ID)
  - Total Price for Items (in TK)
  - Remark discount (Percentage + Amount of the percentage from the total Price)
  - Net Payable TK (Total Price - Remark Discount Cut)
- **Input:**
  - Enter Discount Price (Optional)
  - Advance Tk (optional && if entered = the Full Paid will be no Automatically)
  - Full Paid (Yes / No)
  - Extra description (Optional)
- **Display Update:**
  - Net Payable Tk (Previous - Discount , if applicable)
  - In Words (Net Payable Amount in TK)
  - Advance Tk (If applicable)
  - Due TK (Net Payable - Advance)
  - Bill ID: `P{10 digit and unique each time by checking the database}`
- **Print Slip**

#### ~ Checkout
- **List of Card snippets** of Test Slips with status of *Not delivered (Test Report)* only.
- **Card Snippet Details:**
  - Bill ID
  - Test Date
  - Report Delivery Date & time
  - Net Price in TK
  - Full Paid (`?= yes / no`)
  - Due in TK
  - Report Delivery Status = Not Delivered (only)
- **Action Items for each Card:**
  - View Details
  - Checkout (Will update the status to Delivered)
- **If clicked on View Details:**
  - Full visibility of the report slip document toggled as printed version
  - Extra information = Report Delivery Status
- **Search & Sort:**
  - Searching option for anything
  - Sorting Method (Time = asc/desc)

#### ~ Directory
- **List of Card snippets** of Test Slips (Test Report)
- **Card Snippet Details:**
  - Bill ID
  - Test Date
  - Report Delivery Date & time
  - Net Price in TK
  - Full Paid (`?= yes / no`)
  - Due in TK
  - Report Delivery Status
- **Action Items for each Card:**
  - View Details
- **If clicked on View Details:**
  - Full visibility of the report slip document toggled as printed version
  - Extra information = Report Delivery Status
- **Search & Sort:**
  - Searching option for anything
  - Sorting Method (Time = asc/desc)

---

### (02) Appointment

#### ~ Dashboard
- **List of Doctors Available** for Appointment in the Hospital
- **Each Doctor's Card Will Have:**
  - Doctor's Image
  - Doctor's Name + ID
  - Doctor's Title
  - Specialty of Doctors
  - Contact No (If any)
  - Chamber Time
  - Visit Amount = (New Patient Visit Price + Old Patient Price)
  - **Appointment Button** (For Booking Appointment):
    - Clicking opens a popup layout with `{Live-Ap + Pre-AP}` buttons.
    - Navigates to the selected section with the doctor auto-selected.

#### ~ Live-AP
- **Select:**
  - Search & Select from the list of Dropdown of Doctors (containing all doctor info)
- **Input:**
  - Patient Name
  - Contact Number
  - Age
- **Select:**
  - Gender (`Male / Female / Other`)
- **Display:**
  - **Patient History:**
    - Previous records triggered by entered Name or Number.
    - Displays records and last visit date if found.
    - Classifies as: `Old Patient`, `New Patient`, or `Updated New` (if previous visit expired > 3 months).
  - Date = Today
  - Visiting Duration (From `{Time}` to `{Time}`)
  - Visiting Price (diff for Old patient / New Patient)
  - Patient ID assignment (`New Patient ID + (New Patient)` or `Old Patient ID + (Old Patient)`)
- **Print Document**

#### ~ Pre-AP
- **Select:**
  - Search & Select from the list of Dropdown of Doctors
- **Input:**
  - Patient Name
  - Contact Number
  - Age
- **Select:**
  - Gender (`Male / Female / Other`)
- **Display:**
  - Patient History (Same logic as Live-AP: Old, New, Updated New)
  - Date = Today
  - Visiting Duration (From `{Time}` to `{Time}`)
  - Visiting Price
  - Patient ID assignment
- **Complete Button**

#### ~ Pre-Record
#### ~ Directory

---

### (03) Booking
- Patient Booking
- Emergency

---

### (04) Management
- Tests
- Doctors
- Reference
- Bookings
- Dev - Tunnel

---

### (05) Archive
- Tests Analysis
- Referer Analysis
- Doctors Analysis
- Analytics Page
