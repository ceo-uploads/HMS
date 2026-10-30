# Current Version :
    Current Software Version = v1.0.6
# Update work needed now and final update verision of this software now :
    Final Work for Version = v1.0.7

## Update workflow :
    We are now working for a new version there. The requirements are being marked down here.

## Site :
    Change the Login Username = {kph2026} , Password  = {kph@2026}

## Counter :
    (01) In the New Test Bill Layout, There need to be added a new feature, In the new 
        Test Layout, while the user entering a new patient name, there will be a customized tooltip, this tooltip will show the suggestion while entering new names, the naming suggestions will be updated character by character, by clicking on any suggested name from the tooltip, there will be the field = {Patient Name} + {Age} + {Gender} + {Contact Mobile Number} ;; will be automatically filled up by checking the selected patients previous (Latest) entries from the local db (json).

## Cabins :
    (01) In the Generated Room Bills, while adding any service items (Not the Cabin/Bed charge and admission fee), there will be 
        A service charge will be fixed at 20% of the total added service items for the patient in the cabin, this 20% amount will be added with the total amount of there Billings and will be remarked the price added of the service charge in the billing document and will be visible also in the new cabin book UI layout...

## Doctors & Specialists (Image Extract Integration) :
    (01) Added all 10 specialized doctors from visiting cards, clinic banner, and prescription pad into `Database/doctor-appointment-db.json` and default stores:
        - ডাঃ উম্মে সালমা (প্রিয়া) / Dr. Umme Salma (Priya) (Dermatology & Allergy - BMDC A-139978)
        - ডাঃ মাধবীলতা (নিশি) / Dr. Madhabilata (Nishi) (Gynecology & Obs - BMDC A-123592)
        - ডাঃ মোঃ সাইফ উল্যাহ সুজন / Dr. Md. Saif Ullah Sujan (Urology & Laparoscopic Surgery)
        - ডাঃ ফাতেমা ফারহানা / Dr. Fatema Farhana (ENT & Head-Neck Surgery)
        - ডাঃ মোঃ ফজলুল হক বাকের / Dr. Md. Fazlul Haque Baker (Medicine, Rheumatology, Diabetes - Reg: A-47219)
        - ডাঃ আফসারুল আমিন / Dr. Afsarul Amin (Medicine, Nephrology, Diabetes)
        - ডাঃ ইয়াসিন আরাফাত বিপুল / Dr. Yasin Arafat Bipul (Cardiology & Medicine)
        - ডাঃ মোঃ হাসিবুল হক / Dr. Md. Hasibul Haque (Pediatrics & Neonatology)
        - ডাঃ আশরাফ আহমেদ / Dr. Ashraf Ahmed (Pediatrics & Child Nutrition - Reg: A-106800)
        - আল মেহেদী হাছিব / Al Mehedi Hasib (Sub-Assistant Medical Officer - BMDC Reg: D-25429)

## Indoor Bill Slip Service Items :
    (01) Added all service items lines 03 to 21 from pre-printed indoor billing memo into `Database/clinic-test-db.json` and `main.cjs` default store:
        - 03 Investigation (Parent Group: Pathology, X-Ray, E.C.G, Ultrasonography, Endoscopy, Echocardiography)
        - 04 Oxygen Charge
        - 05 O.T Charge
        - 06 Operation Charge (Parent Group: Surgeon Fee, 1st Asstt Fee, 2nd Asstt Fee, 3rd Asstt Fee)
        - 07 Anesthesia Charge
        - 08 Delivery Charge
        - 09 Dressing Charge
        - 10 Transfusion Charge
        - 11 Cost of Medicine
        - 12 Consultant Fee
        - 13 Medical Board (Doctors)
        - 14 Medical Board (Clinic)
        - 15 Stitch of Charge
        - 16 Ambulance Fare
        - 17 Ryles-Tub, Enema, Catheterization / IV Cannula Charge
        - 18 Nabulization
        - 19 Phototherapy
        - 20 Cardiac Monitor
        - 21 Instrument Charge
    (02) Automated matching & population of selected service items directly onto the pre-printed slip lines in `renderIndoorBill`.

## Dark / Night Mode System :
    (01) Integrated Uiverse.io sun/moon animated switch (by JkHuger) into the custom title windowbar.
    (02) Added accelerator shortcut `<kbd>Ctrl+D</kbd> Theme` in the application header for quick toggling.
    (03) Added zero-flash instant theme restoration script in `<head>` of `UI/index.html` backed by `localStorage.getItem('hmss-theme')`.
    (04) Comprehensive clinical dark palette: deep obsidian/slate canvas (`#0b1320`), navy-slate surface cards (`#131f32`), border lines (`#203147`), medical emerald/sky accents (`#0284c7`, `#38bdf8`), muted metadata (`#94a3b8`), crisp white text (`#f8fafc`).
    (05) Strict print isolation: physical bills, indoor slips, cash memos, and receipts remain pure white paper (`#ffffff`) with black ink and borders in both light and dark modes.

## Professional UI Styling & Responsiveness :
    (01) Non-robotic, clean clinical typography and visual hierarchy avoiding neon/glassmorphic cliches.
    (02) Bengali font support (`Noto Sans Bengali`, `Kalpurush`, `SolaimanLipi`) for specialist credentials, chamber hours, and designations.
    (03) Auto-fill responsive grids for doctors (`repeat(auto-fill, minmax(290px, 1fr))`), cabins (`repeat(auto-fill, minmax(250px, 1fr))`), and metrics.
    (04) Smooth scrollbars, gentle hover elevations, and accessible focus rings.
