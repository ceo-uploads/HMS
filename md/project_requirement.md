[ Hospital Management Software]

[ Architecture :
	Rust & React js
	Windows Application

	Kotlin
	Monitoring Android Apk
]


[Requires Authentication :
	Username + Password
]


[ Containing's :
	(01) Counter
	(02) Appointment
	(03) Booking
	(04) Management
	(05) Archive
]


[ Counter :
	-> Tabs :
		~ Dashboard (Dashboard For Medical Tests) :
			* List Of Clinical Test Available with :
				# Code
				# Test Name
				# Price
		~ Tests :
			* Inputs :
				# Name (Character)
				# Age (Number)
				# Gender (Select?= Male / Female / Other)
				# Contact Number (Mobile Number)
			* Select :
				# Reference (Search & Select = Doctors from the dropdown List + Can be selected Multiple)
				# Select Test (Search & Select = Tests from the dropdown List + Can be selected Multiple)
				# Select Remarks (Search & Select = Special Reference from the List + Can be Selected Multiple)
				# Select Delivery Date & Time (Easy to select = Date + time + Day)
			* Display :
				# Selected Doctors Details
				# Selected Test Details (Code + Test Name + Price in TK)
				# Application Time = Exact Date and Time (Format = HH-MM + DD/MM/YYYY)
				# Remark (Special Reference Code/ID)
				# Total Price for Items (in TK)
				# Net Payable TK (Total Price)
			* Input :
				# Enter Discount Price (Optional)
				# Advance Tk (optional && if entered = the Full Paid will be no Automatically)
				# Full Paid (Yes / No)
				# Extra description (Optional)
			* Display Update :
				# Net Payable Tk (Previous - Discount , if applicable)
				# In Words (Net Payable Amount in TK)
				# Advance Tk (If applicable)
				# Due TK (Net Payable - Advance)
				# Bill ID : P{10 digit and unique each time by checking the database}
				# Report Delivery Time (Format = HH-MM + DD/MM/YYYY)
			* Print Slip :


		~ Checkout :
			* List of Card snippets of Test Slips and with status of Not delivered (Test Report) only
			* The Card snippets will have the visible details :
				# Bill ID
				# Test Date
				# Report Delivery Date & time
				# Net Price in TK
				# Full Paid (?= yes / no)
				# Due in TK
				# Report Delivery Status = Not Delivered (only)
			* Following Action Items for each Cards :
				# View Details
				# Checkout (Will update the status to Delivered and dues will be cleared)
			* If clicked on View Details :
				# The full visibility of the report slip document will be toggled as printed version
				# extra information = Report Delivery Status
			* Searching anything Option
			* Sorting Method (Time = asc/desc)
		~ Directory :
			* List of Card snippets of Test Slips (Test Report)
			* The Card snippets will have the visible details :
				# Bill ID
				# Test Date
				# Report Delivery Date & time
				# Net Price in TK
				# Full Paid (?= yes / no)
				# Due in TK
				# Report Delivery Status
			* Following Action Items for each Cards :
				# View Details
			* If clicked on View Details :
				# The full visibility of the report slip document will be toggled as printed version
				# extra information = Report Delivery Status
			* Searching anything Option
			* Sorting Method (Time = asc/desc)

]




[ Appointment :
	-> Tabs :
		~ Dashboard :
			* List of Doctors Available for Appointment in the Hospital
			* Each Doctors Card Will Have :
				# Doctors Image
				# Doctors Name + ID
				# Doctors Title
				# Specialty of Doctors
				# Contact No (IF any)
				# Chamber Visiting Time
				# Visit Amount = (New Patient Visit Price + Old Patient Price)
				# Appointment Button (For Booking Appointment) :
					## After Clicking the Appointment Button it will Popup a layout
					## The Popup layout will have = {Live-Ap + Pre-AP} Buttons
					## If Clicking on those button will navigate to the section of selected (Live-AP/Pre-AP)
					## And also navigate with the doctors selected there automatically
		~ Live-AP :
			* Select :
				# Search & Select = From the list of Dropdown of Doctors
				# Each Dropdown item will contain every info of the Doctors
			* Input :
				# Patient Name :
				# Contact Number :
				# Age :
			* Select :
				# Gender : {Male / Female / Other}
			* Display :
				# Patient History :
					## Previous Records of the Entered Patient
					## The record will be triggered by the Entered Name or Number
					## If Found,, it will show the records and last visit date also.
					## If the Number or Name has previous Records it will show as = Old Patient , else New patient
					## Other case,, if the previous records expires 3 month of visit,, then it will show = Updated New
				# Date = Today
				# Visiting Duration (From {Time} to {Time})
				# Visiting Price = {diff for Old patient / New Patient}
				# If New Patient =  New Patient ID + (New Patient)
				# If Old Patient = Old Patient ID + (Old Patient)
				# Status = Done
			* Print Document :
		~ Pre-AP :
			* Select :
				# Search & Select = From the list of Dropdown of Doctors
				# Each Dropdown item will contain every info of the Doctors
			* Input :
				# Patient Name :
				# Contact Number :
				# Age :
			* Select :
				# Gender : {Male / Female / Other}
			* Display :
				# Patient History :
					## Previous Records of the Entered Patient
					## The record will be triggered by the Entered Name or Number
					## If Found,, it will show the records and last visit date also.
					## If the Number or Name has previous Records it will show as = Old Patient , else New patient
					## Other case,, if the previous records expires 3 month of visit,, then it will show = Updated New
				# Date = Today
				# Visiting Duration (From {Time} to {Time})
				# Visiting Price = {diff for Old patient / New Patient}
				# If New Patient =  New Patient ID + (New Patient)
				# If Old Patient = Old Patient ID + (Old Patient)
				# Status = Pending
			# Compete Button :
		~ Pre-Record :
			* Record List Card Snippets for the Pre-AP
			* Each card will contain every information stored
			* Every card list will have the action following :
				# View Full Document
				# Proceed Appointment to Complete (Also Print Slip) and status will be = Done
		~ Directory :
			* List of Cards Snippets of the Records with status Done
			* Searching Anything option
			* Sorting Method
]



[ Booking :
	-> Tabs :
		~ Cabins :
			* List of All Cabins As Grids
				# Each Grids will have the Room name
				# each rooms grids will contain red color with status = occupied
				# The Already Booked Cabin will be red and will show time text (Date & Time) as the New available time.
			* If clicking on grid with status = available :
				# Cabin booking Layout will Popup then :
					## Patient Name
					## Age
					## Contact Number
					## Gender
					## Enter Duration
					## Room ID (Display)
					## Cabin Price (Display)
					## Other Items (Item Name and price as input) (Optional)
					## Net Amount Payable
					## Discount Added (Optional)
					## Update Net Amount = if Discount price added.
					## Advance Payment (Optional)
					## Update due = if advance added
					## Print
			* Renew :	
				# Renew Any existing duration of cabin booked
			* After ending the duration,, the red flag (Occupied Title) will be gone and status will be updated to = available
		~ Directory :
			* history Of each Items there.
			* Latest First
			* Search Anything
			* Smart sorting Methods
]




[ Management :
	-> Tabs :
		~ Tests :
			* List Of Clinical Test : 
				# Code	
				# Name
				# Price
				## Special See Archive Button Navigate to => Archive => Test Analysis
			* Each List Have Update Button to make update in:
				# Code
				# Name
				# Price
			* In the list,, User can Add new Clinical Test Items :
				# Code (input)
				# Name (input)
				# Price (input)
			* And Can Have Option TO delete any Clinical Test Item	
		~ Doctors :
			* List Of Doctors :
				# Doctor Image
				# Doctor Name
				# Doctor Code / ID
				# Doctor Title
				# Doctor Contact
				# Visiting Time (Can Be Multiple)
				# Visit Price ( Old Patient / New Patient)
				## Special See Archive Button Navigate to => Archive => Doctor Analysis
			* Also There have update button to make update on any doctors :
				# Doctor Image
				# Doctor Name
				# Doctor Code / ID
				# Doctor Title
				# Doctor Contact
				# Visiting Time (Can Be Multiple)
				# Visit Price ( Old Patient / New Patient)
			* Also Have Add Doctors option, it will take the input as :
				# Doctor Image
				# Doctor Name
				# Doctor Code / ID (Auto Generated with a fixed format and unique every time)
				# Doctor Title
				# Doctor Contact
				# Visiting Time (Can Be Multiple)
				# Visit Price ( Old Patient / New Patient)
			* And also have deleting features to delete any doctor from the list
		~ Reference :
			* List Of Marketing Agent :
				# Image
				# Name
				# Code / ID
				# Contact Number
				# Select = {For Each} List of Special Referrer (Under the selected Marketing Agent)  and list have :
					## Image
					## Name
					## Code / ID 
					## Contact Number
			* Special Referrer Management :
				# Search & Select By Anything there
				# Update in any Field :
					## Image
					## Name
					## Code / ID 
					## Contact Number
					## Move to Agent = Select from the list of Marketing Agent
				# Delete any Special Referrer
			* Marketing Agent Management :
				# Search & Select By anything there
				# Add Referrer to the Agent (Selected Agent) :
					## Image
					## Name
					## Code / ID
					## Contact Number
				# Update Any Marketing Agent :
					## Image
					## Name
					## Code / ID
					## Contact Number
				# Add Referrer within Agent :
					## Image
					## Name
					## Code / ID
					## Contact Number
					## Search & Select any marketing agent from the list
				# Delete any marketing agent
				 
		~ Bookings :
			* List of cabins
			* with every information
			* Update :
				# Cabin Name
				# ID and others
				# Booking Prices
			* Add New Cabin :
				# Cabin Name
				# ID and Others
				# Booking Prices
			* Delete Cabin Option
		~ Dev - Tunnel :
]






[ Archive :
	-> Tabs :
		~ Live Summery :
			* Live records of the {tests + doctor + cabin} Records with every details and payment information's also
			* will be like a card snippet and have a full view button.
			* Print today summery option :
				# A4 format and multiple pages
		~ Tests Analysis :
			* Data of Day to Day Tests List :
				# Each list will contain the test slips and every information of the tests as stored
				# Searching anything
				# Sorting Method (Full Paid + With Due + Report Delivered {Completed})
			* Pagination (Controlled with Date and month / date-year-month selection)
			* Smart Items :
				# Last 7 Day :
					## A page with Loaded last 7 day history data
				# Last 30 Day :
					## A page with loaded last 30 day history data
				# Custom Range :
					## Selection of {From_Date to To_Date}
					## A page with loaded the date range history data
			* Analysis :
				# For Each Tests :
					## Today Record
					## Selective Date Record
					## Selective Range Data Record
					## Records Forever
					## Smart Analytical and data science and graph Items
				# Earnings:: For each Tests :
					## Today Earnings and  Remaining dues
					## Selective Date Earning Records
					## Selective Date Range Earning Records
					## Forever Earning Records and Estimated Remaining Dues 
			* Print as PDF (The Selected Page DATA)
		~  Marketing Agent & Referrer Analysis :
			* Data For Each Marketing Agent :
				# List of Every Marketing Agents (Super Agent)
				# Every Data of the Marketing Agent
				# Select = See Special Referrer Data / Details Under the Selected Marketing Agent :
					## Data For Each Referrer List :
						### Each list will contain every information of the Referrer tests as stored
						### Searching anything
						### Sorting Method 
					## For Each Referrer in the List :
						### Total Test patent from the Referrer
						### Total Test from there patient [Today / date pagination / custom range / forever]
						### Total Amount Earned from there Patients [Today / date pagination / custom range / Forever]
						### Total Dues Remaining From there Patients
			
			* Pagination (Controlled with Date and month / date-year-month selection)
			* Smart Items :
				# Last 7 Day :
					## A page with Loaded last 7 day history data
				# Last 30 Day :
					## A page with loaded last 30 day history data
				# Custom Range :
					## Selection of {From_Date to To_Date}
					## A page with loaded the date range history data
			* Analysis :
				# For Each Marketing Agent &
				# For Each Referrer :
					## Today Record
					## Selective Date Record
					## Selective Range Data Record
					## Records Forever
					## Smart Analytical and data science and graph Items
		~ Doctors Analysis :
			* Data of Doctors List :
				# Each list will contain every information of the Patient of the Doctor as stored
				# Searching anything
				# Sorting Method
			* Pagination (Controlled with Date and month / date-year-month selection)
			* Smart Items :
				# Last 7 Day :
					## A page with Loaded last 7 day history data
				# Last 30 Day :
					## A page with loaded last 30 day history data
				# Custom Range :
					## Selection of {From_Date to To_Date}
					## A page with loaded the date range history data
			* Analysis :
				# For Each Tests :
					## Today Record (New Patient / Old Patient && There visits Earned)
					## Selective Date Record
					## Selective Range Data Record
					## Records Forever
					## Smart Analytical and data science and graph Items
		~ Bookings Analysis :
		~ Analytics Page :
			* Today :
				# Total Clinical Test Record and other statistical analysis
				# Total Earnings and due
				# Total Received
			* This Week (From the last Saturday to Friday)
			* This Month (From the 1at day of the Month)
			* Custom Ranging
		~ {Every section has printing support and in A4 Format and can have multiple pages}
]