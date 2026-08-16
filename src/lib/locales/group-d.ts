import type { Locale } from "./index";

/** Group d strings: TopBar, VoiceAssistant, NotificationsBell, TicketFilters,
 * EmergencyBanner, MaskedCallModal, GeoCamera, OfficerBadge, DemoBypass, CinematicIntro. */
export const groupd: Locale = {
  // assistant.*
  "assistant.showSources": { en: "Show sources", ta: "ஆதாரங்களைக் காட்டு" },
  "assistant.hideSources": { en: "Hide sources", ta: "ஆதாரங்களை மறை" },
  "assistant.muteVoice": { en: "Mute voice replies", ta: "குரல் பதில்களை முடக்கு" },
  "assistant.unmuteVoice": { en: "Unmute voice replies", ta: "குரல் பதில்களை இயக்கு" },
  "assistant.langLabelTaFirst": { en: "English / தமிழ்", ta: "தமிழ் / English" },
  "assistant.handsFreeSuffix": { en: " · hands-free", ta: " · கை-இல்லா" },
  "assistant.thinking": { en: "Thinking…", ta: "யோசிக்கிறேன்…" },
  "assistant.toggleMic": { en: "Toggle microphone", ta: "மைக்கை மாற்று" },
  "assistant.toggleHandsFree": { en: "Toggle hands-free conversation", ta: "கை-இல்லா உரையாடலை மாற்று" },
  "assistant.placeholder": { en: "Ask anything…", ta: "கேளுங்கள்…" },
  "assistant.send": { en: "Send", ta: "அனுப்பு" },
  "assistant.noSpeechRecognition": {
    en: "Speech recognition isn't available in this browser — please type instead.",
    ta: "இந்த உலாவியில் பேச்சு அங்கீகாரம் இல்லை. தட்டச்சு செய்யவும்.",
  },
  "assistant.references": { en: "References", ta: "மேற்கோள்கள்" },
  "assistant.greeting": {
    en: "Vanakkam. I'm the civic voice assistant, trained on the full TN SmartMunicipality portal — identity gateway, geotag camera, SLA escalation matrix, GCC routing, anonymity and closure voting. Ask me anything, in English or Tamil.",
    ta: "வணக்கம். நான் TN SmartMunicipality போர்ட்டல் முழுவதும் பயிற்சி பெற்ற குடிமை குரல் உதவியாளர். ஆங்கிலம் அல்லது தமிழில் எதையும் கேளுங்கள்.",
  },
  "assistant.fallback": {
    en: "I can help with filing a geotagged grievance, tracking and escalation, DigiLocker/IFHRMS registration, SLA and GCC routing rules, anonymity, or closure voting.",
    ta: "புகார் அளித்தல், கண்காணிப்பு, டிஜிலாக்கர்/IFHRMS பதிவு, SLA & GCC விதிகள், அநாமதேயம், முடிவு வாக்கெடுப்பு — உதவ முடியும்.",
  },
  "assistant.uncited": {
    en: "No matching municipality policy reference was found for this answer — treat it as general guidance and confirm with the SLA report archive or your ward office before acting.",
    ta: "இந்த பதிலுக்கு பொருந்தும் நகராட்சி கொள்கை ஆதாரம் கிடைக்கவில்லை — இதை பொதுவான வழிகாட்டுதலாகக் கருதி, SLA அறிக்கை காப்பகம் அல்லது வார்டு அலுவலகத்தில் உறுதிப்படுத்தவும்.",
  },
  "assistant.poweredByGemini": { en: " · Gemini AI", ta: " · Gemini AI" },

  // notif.*
  "notif.markAllRead": { en: "Mark all read", ta: "அனைத்தையும் படித்ததாக" },
  "notif.empty": { en: "No notifications yet.", ta: "இதுவரை அறிவிப்புகள் இல்லை." },
  "notif.download": { en: "Download →", ta: "பதிவிறக்கு →" },
  "notif.markRead": { en: "Mark read", ta: "படித்ததாகக் குறி" },

  // filters.*
  "filters.ariaLabel": { en: "Ticket filters", ta: "வடிப்பான்கள்" },
  "filters.searchPlaceholder": {
    en: "Search title, address, officer, category…",
    ta: "தலைப்பு, பகுதி, அலுவலர் தேடு…",
  },
  "filters.searchAria": { en: "Search tickets", ta: "தேடல்" },
  "filters.clearSearch": { en: "Clear search", ta: "தேடலை அழி" },
  "filters.reset": { en: "Reset", ta: "அழி" },
  "filters.ward": { en: "Ward", ta: "வார்டு" },
  "filters.allWards": { en: "All wards", ta: "அனைத்து வார்டுகள்" },
  "filters.status": { en: "Status", ta: "நிலை" },
  "filters.allStatuses": { en: "All statuses", ta: "அனைத்து நிலைகள்" },
  "filters.priority": { en: "Priority", ta: "முன்னுரிமை" },
  "filters.allPriorities": { en: "All priorities", ta: "அனைத்து முன்னுரிமை" },
  "filters.department": { en: "Department", ta: "துறை" },
  "filters.allDepartments": { en: "All departments", ta: "அனைத்து துறைகள்" },
  "filters.resultsTemplate": {
    en: "Showing {result} of {total} tickets",
    ta: "{total} இல் {result} புகார்கள் காட்டப்படுகின்றன",
  },

  // alert.*
  "alert.geofencedTemplate": {
    en: "Geofenced push · within {radius} m of your position",
    ta: "புவிவேலி அறிவிப்பு · உங்கள் இருப்பிடத்திலிருந்து {radius} மீ க்குள்",
  },
  "alert.dismiss": { en: "Dismiss alert", ta: "எச்சரிக்கையை நிராகரி" },

  // call.*
  "call.maskedRelay": { en: "Masked VoIP relay", ta: "மறைக்கப்பட்ட VoIP தொடர்பு" },
  "call.connectedTemplate": { en: "Connected · {time}", ta: "இணைக்கப்பட்டது · {time}" },
  "call.bridging": { en: "Bridging secure line…", ta: "பாதுகாப்பான இணைப்பை உருவாக்குகிறது…" },
  "call.numberMaskingActive": { en: "Number masking active", ta: "எண் மறைப்பு செயலில் உள்ளது" },
  "call.maskingDescTemplate": {
    en: "Officer sees {alias} · You see relay {relay}. Neither cellular number is exchanged or logged.",
    ta: "அலுவலருக்கு {alias} தெரியும் · உங்களுக்கு தொடர்பு எண் {relay} தெரியும். இரு தொலைபேசி எண்களும் பரிமாறப்படுவதோ பதிவு செய்யப்படுவதோ இல்லை.",
  },
  "call.mute": { en: "Mute", ta: "முடக்கு" },
  "call.unmute": { en: "Unmute", ta: "முடக்கு நீக்கு" },
  "call.endCall": { en: "End call", ta: "அழைப்பை முடி" },

  // camera.*
  "camera.rejectedTitle": {
    en: "Submission Rejected: Authentic Geotagged Capture Required",
    ta: "சமர்ப்பிப்பு நிராகரிக்கப்பட்டது: உண்மையான புவிக்குறியிட்ட படம் தேவை",
  },
  "camera.rejectedNoFix": {
    en: "No live GPS fix. Enable location services and retry.",
    ta: "நேரடி GPS தகவல் இல்லை. இருப்பிட சேவைகளை இயக்கி மீண்டும் முயற்சிக்கவும்.",
  },
  "camera.rejectedStaleFixTemplate": {
    en: "Stale location fix ({seconds}s old) — mock-location signature detected. File purged.",
    ta: "பழைய இருப்பிடத் தகவல் ({seconds} வி பழையது) — போலி-இருப்பிட கையொப்பம் கண்டறியப்பட்டது. கோப்பு அழிக்கப்பட்டது.",
  },
  "camera.rejectedBadAccuracy": {
    en: "Implausible GPS accuracy reported by the device. File purged.",
    ta: "சாதனம் தெரிவித்த GPS துல்லியம் நம்பகமானதாக இல்லை. கோப்பு அழிக்கப்பட்டது.",
  },
  "camera.rejectedNoStream": {
    en: "No live camera stream. Gallery and file uploads are not accepted.",
    ta: "நேரடி கேமரா ஸ்ட்ரீம் இல்லை. கேலரி மற்றும் கோப்பு பதிவேற்றங்கள் ஏற்கப்படாது.",
  },
  "camera.accessRequired": { en: "Camera access required", ta: "கேமரா அணுகல் தேவை" },
  "camera.disabledDescTemplate": {
    en: "{error}. Gallery uploads are permanently disabled on this portal — a live hardware capture is the only accepted evidence source.",
    ta: "{error}. இந்த தளத்தில் கேலரி பதிவேற்றம் நிரந்தரமாக முடக்கப்பட்டுள்ளது — நேரடி கேமரா படம் மட்டுமே ஏற்கப்படும்.",
  },
  "camera.retry": { en: "Retry camera", ta: "கேமராவை மீண்டும் முயற்சி" },
  "camera.locationErrorTemplate": { en: "Location error: {error}", ta: "இருப்பிடப் பிழை: {error}" },
  "camera.captureButton": { en: "Capture geotagged evidence", ta: "புவிக்குறியிட்ட சான்றை எடு" },
  "camera.unavailable": { en: "Camera unavailable", ta: "கேமரா கிடைக்கவில்லை" },
  "camera.acceptedTitle": { en: "Geotagged capture accepted", ta: "புவிக்குறியிட்ட படம் ஏற்கப்பட்டது" },
  "camera.acceptedDesc": {
    en: "EXIF inspector: live sensor stream + fresh GPS fix confirmed.",
    ta: "EXIF ஆய்வாளர்: நேரடி சென்சார் ஸ்ட்ரீம் + புதிய GPS தகவல் உறுதி செய்யப்பட்டது.",
  },

  // badge.*
  "badge.govTn": { en: "Government of Tamil Nadu", ta: "தமிழ்நாடு அரசு" },
  "badge.maws": {
    en: "Municipal Administration & Water Supply",
    ta: "நகராட்சி நிர்வாகம் மற்றும் குடிநீர் வழங்கல்",
  },
  "badge.subtitle": {
    en: "Digital Officer ID Badge · IFHRMS Verified",
    ta: "டிஜிட்டல் அலுவலர் அடையாள அட்டை · IFHRMS சரிபார்க்கப்பட்டது",
  },
  "badge.officerFallback": { en: "Officer on Roster", ta: "பணிப்பட்டியல் அலுவலர்" },
  "badge.deptFallback": { en: "Municipal Administration", ta: "நகராட்சி நிர்வாகம்" },
  "badge.name": { en: "Name", ta: "பெயர்" },
  "badge.designation": { en: "Designation", ta: "பதவி" },
  "badge.department": { en: "Department", ta: "துறை" },
  "badge.ifhrmsId": { en: "IFHRMS ID", ta: "IFHRMS எண்" },
  "badge.jurisdiction": { en: "Jurisdiction", ta: "அதிகார எல்லை" },
  "badge.unassigned": { en: "Unassigned", ta: "ஒதுக்கப்படவில்லை" },
  "badge.rosterActive": { en: "Roster status: Active", ta: "பணிப்பட்டியல் நிலை: செயலில்" },
  "badge.digilocker": {
    en: "DigiLocker · TN Govt Service Certificate",
    ta: "டிஜிலாக்கர் · தமிழ்நாடு அரசு சேவைச் சான்றிதழ்",
  },
  "badge.scanVerify": { en: "Scan on-site to verify identity", ta: "அடையாளத்தை சரிபார்க்க இடத்திலேயே ஸ்கேன் செய்யவும்" },
  "badge.emblemAlt": { en: "Tamil Nadu State Emblem", ta: "தமிழ்நாடு அரசு சின்னம்" },
  "badge.disclaimerPrefix": {
    en: "This badge is a demo credential. In production the QR resolves to a signed MAWS attestation at",
    ta: "இந்த அட்டை ஒரு டெமோ சான்றாகும். நடைமுறையில் QR குறியீடு கையொப்பமிடப்பட்ட MAWS உறுதிமொழிக்கு இணைக்கும்",
  },

  // demo.*
  "demo.title": { en: "Test mode — skip DigiLocker", ta: "சோதனை முறை — டிஜிலாக்கரைத் தவிர்" },
  "demo.subtitle": {
    en: "One-tap demo sign-in. Bypasses Aadhaar / IFHRMS OTP binding for evaluation only.",
    ta: "ஒரு-தட்டல் டெமோ உள்நுழைவு. மதிப்பீட்டிற்காக மட்டும் ஆதார் / IFHRMS OTP இணைப்பைத் தவிர்க்கிறது.",
  },
  "demo.citizen": { en: "Citizen", ta: "குடிமகன்" },
  "demo.worker": { en: "Municipal Worker", ta: "மாநகராட்சி பணியாளர்" },
  "demo.fieldOfficer": { en: "Field Officer", ta: "களப்பணி அலுவலர்" },
  "demo.zonalAc": { en: "Zonal AC", ta: "மண்டல உதவி ஆணையர்" },
  "demo.commissioner": { en: "Commissioner", ta: "ஆணையர்" },
  "demo.wardCouncillor": { en: "Ward Councillor", ta: "வார்டு மாமன்ற உறுப்பினர்" },
  "demo.ifhrmsTemplate": { en: "IFHRMS {id}", ta: "IFHRMS {id}" },
  "demo.signedInTemplate": { en: "Test mode — signed in as {label}", ta: "சோதனை முறை — {label} ஆக உள்நுழைந்தது" },
  "demo.simulatedIfhrmsTemplate": { en: "Simulated IFHRMS {id}", ta: "போலி IFHRMS {id}" },
  "demo.simulatedAadhaar": { en: "Simulated Aadhaar citizen persona", ta: "போலி ஆதார் குடிமகன் பாத்திரம்" },
  "demo.signInFailed": { en: "Demo sign-in failed.", ta: "டெமோ உள்நுழைவு தோல்வியடைந்தது." },
  "demo.sessionFailed": { en: "Demo session could not be created.", ta: "டெமோ அமர்வை உருவாக்க முடியவில்லை." },

  // intro.*
  "intro.republicOfIndia": { en: "Republic of India", ta: "இந்திய குடியரசு" },
  "intro.locatingSouth": { en: "Locating southern region", ta: "தென் பகுதி கண்டறியப்படுகிறது" },
  "intro.tamilNadu": { en: "TAMIL NADU", ta: "தமிழ்நாடு" },
  "intro.coordinates": {
    en: "11.13° N · 78.66° E — Urban Local Bodies",
    ta: "11.13° வ · 78.66° கி — நகர்ப்புற உள்ளாட்சி அமைப்புகள்",
  },
  "intro.brandTag": { en: "Tamil Nadu · MAWS", ta: "தமிழ்நாடு · MAWS" },
  "intro.smartMunicipality": { en: "Smart Municipality", ta: "ஸ்மார்ட் நகராட்சி" },
  "intro.tagline": {
    en: "Geotagged grievances · SLA-driven escalation · transparent ward accountability",
    ta: "புவிக்குறியிட்ட புகார்கள் · SLA அடிப்படையிலான மேல்முறையீடு · வெளிப்படையான வார்டு பொறுப்புணர்வு",
  },
  "intro.skip": { en: "Skip intro", ta: "அறிமுகத்தைத் தவிர்" },
  "intro.ariaZoom": { en: "Zooming from India to Tamil Nadu", ta: "இந்தியாவிலிருந்து தமிழ்நாடு நோக்கி பெரிதாக்கம்" },
  "intro.emblemAlt": { en: "Government of Tamil Nadu emblem", ta: "தமிழ்நாடு அரசு சின்னம்" },
  "landing.tagline": { en: "Your City. Your Voice. Your Solution.", ta: "உங்கள் நகரம். உங்கள் குரல். உங்கள் தீர்வு." },
  "landing.skip": { en: "Skip", ta: "தவிர்" },
  "landing.citizenCentric": { en: "Citizen Centric", ta: "குடிமகன் மையமாக" },
  "landing.citizenCentricSub": { en: "People First", ta: "மக்கள் முதலில்" },
  "landing.smartSolutions": { en: "Smart Solutions", ta: "ஸ்மார்ட் தீர்வுகள்" },
  "landing.smartSolutionsSub": { en: "Technology Led", ta: "தொழில்நுட்ப வழிகாட்டல்" },
  "landing.transparent": { en: "Transparent", ta: "வெளிப்படைத்தன்மை" },
  "landing.transparentSub": { en: "Open & Accountable", ta: "திறந்த மற்றும் பொறுப்புள்ள" },
};
