import SwiftUI
import MapKit
import CoreLocation

/// «وين نوصلك؟» (design/07-address.webp): خريطة آبل + منطقة التوصيل + دبوس ثابت بالنص، والزبون يحرك الخريطة تحته
struct AddressView: View {
    /// زر الحفظ: «احفظ العنوان» أو «احفظ وأرسل الطلب»
    var confirmTitle = "احفظ العنوان"
    var onSaved: () -> Void = {}

    @Environment(CatalogStore.self) private var catalog
    @Environment(OrderCenter.self) private var orders
    @Environment(\.dismiss) private var dismiss
    @Environment(\.openURL) private var openURL

    @State private var position: MapCameraPosition = .automatic
    @State private var center = CLLocationCoordinate2D(latitude: 24.845, longitude: 46.815)
    @State private var moving = false
    @State private var phone = ""
    @State private var details = ""
    @State private var name = ""
    @State private var phoneError: String?
    @State private var locating = false
    @State private var locationDenied = false
    @State private var locator = LocationFetcher()
    @FocusState private var focus: Field?

    private enum Field { case phone, details, name }

    private var zone: [CLLocationCoordinate2D] {
        catalog.store.zone.map { CLLocationCoordinate2D(latitude: $0[0], longitude: $0[1]) }
    }
    private var inside: Bool { OrderCenter.inZone(center, catalog.store.zone) }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                map
                form
            }
            .background(Color.white)
            .navigationTitle("وين نوصلك؟")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(.visible, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("إلغاء") { dismiss() }
                }
            }
            .alert("ما نقدر نوصل لموقعك", isPresented: $locationDenied) {
                Button("افتح الإعدادات") {
                    if let url = URL(string: UIApplication.openSettingsURLString) { openURL(url) }
                }
                Button("تمام", role: .cancel) {}
            } message: {
                Text("اسمح للتطبيق يعرف موقعك من الإعدادات، أو حرّك الخريطة بنفسك على بيتك.")
            }
        }
        .onAppear(perform: setup)
    }

    // MARK: الخريطة

    private var map: some View {
        Map(position: $position, interactionModes: [.pan, .zoom]) {
            if zone.count >= 3 {
                MapPolygon(coordinates: zone)
                    .foregroundStyle(Theme.brand.opacity(0.10))
                    .stroke(Theme.brand, style: StrokeStyle(lineWidth: 2, dash: [7, 5]))
            }
            UserAnnotation()
        }
        .mapStyle(.standard(emphasis: .muted, pointsOfInterest: .excludingAll))
        .mapControls { MapCompass() }
        .onMapCameraChange(frequency: .continuous) { ctx in
            center = ctx.region.center
            if !moving { withAnimation(.snappy(duration: 0.2)) { moving = true } }
        }
        .onMapCameraChange(frequency: .onEnd) { ctx in
            center = ctx.region.center
            withAnimation(.snappy(duration: 0.25)) { moving = false }
        }
        .overlay { pin.allowsHitTesting(false) }
        .overlay(alignment: .bottomLeading) {
            Button(action: locate) {
                HStack(spacing: 6) {
                    if locating { ProgressView().controlSize(.small) } else { Image(systemName: "location.fill") }
                    Text("موقعي الحالي")
                }
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(Theme.brandDeep)
                .padding(.horizontal, 14).frame(height: 40)
                .background(.white, in: Capsule())
                .shadow(color: .black.opacity(0.12), radius: 6, y: 2)
            }
            .buttonStyle(PressableStyle(scale: 0.95))
            .padding(12)
            .padding(.bottom, 18)   // شعار خرائط آبل والرابط القانوني يبقون ظاهرين
        }
    }

    /// الدبوس: رأسه بالضبط على نص الخريطة، ويرتفع شوي وقت السحب
    private var pin: some View {
        VStack(spacing: 6) {
            Text(inside ? "يوصلك هنا ✓" : "برا منطقة التوصيل")
                .font(.system(size: 13, weight: .bold))
                .foregroundStyle(.white)
                .padding(.horizontal, 12).padding(.vertical, 7)
                .background(inside ? Theme.ink : Theme.copperInk, in: RoundedRectangle(cornerRadius: 10, style: .continuous))
                .opacity(moving ? 0 : 1)
            Image(systemName: "mappin")
                .font(.system(size: 40, weight: .semibold))
                .foregroundStyle(inside ? Theme.brand : Theme.copper)
                .shadow(color: .black.opacity(0.2), radius: moving ? 8 : 3, y: moving ? 8 : 2)
                .offset(y: moving ? -10 : 0)
        }
        .alignmentGuide(VerticalAlignment.center) { d in d[.bottom] }
        .animation(.snappy(duration: 0.25), value: inside)
        .accessibilityHidden(true)
    }

    // MARK: النموذج

    private var form: some View {
        VStack(alignment: .leading, spacing: 12) {
            Label(inside ? "داخل منطقة التوصيل · \(catalog.store.area)" : "حرّك الخريطة لين يصير الدبوس على بيتك داخل المنطقة",
                  systemImage: inside ? "checkmark.circle.fill" : "exclamationmark.circle.fill")
                .font(.system(size: 13.5, weight: .semibold))
                .foregroundStyle(inside ? Theme.brandDeep : Theme.copperInk)

            field("الجوال", text: $phone, prompt: "05XXXXXXXX", field: .phone, error: phoneError)
                .keyboardType(.phonePad)
                .textContentType(.telephoneNumber)
                .onChange(of: phone) { _, _ in phoneError = nil }
            field("البيت", text: $details, prompt: "رقم البيت، لون الباب، علامة قريبة", field: .details)
                .textContentType(.fullStreetAddress)
                .submitLabel(.next)
                .onSubmit { focus = .name }
            field("الاسم", text: $name, prompt: "اختياري", field: .name)
                .textContentType(.name)
                .submitLabel(.done)

            Button(action: save) {
                Text(confirmTitle).frame(maxWidth: .infinity)
            }
            .buttonStyle(PrimaryButtonStyle())
            .disabled(!inside)
            .opacity(inside ? 1 : 0.5)
            .padding(.top, 2)
        }
        .padding(.horizontal, 16)
        .padding(.top, 16)
        .padding(.bottom, 10)
        .background(.white)
        .clipShape(UnevenRoundedRectangle(topLeadingRadius: 24, topTrailingRadius: 24, style: .continuous))
        .shadow(color: .black.opacity(0.06), radius: 10, y: -4)
        .toolbar {
            ToolbarItemGroup(placement: .keyboard) {
                Spacer()
                Button("تم") { focus = nil }
            }
        }
    }

    private func field(_ title: String, text: Binding<String>, prompt: String, field: Field, error: String? = nil) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 12) {
                Text(title)
                    .font(.system(size: 14))
                    .foregroundStyle(Theme.muted)
                    .frame(width: 52, alignment: .leading)
                TextField(prompt, text: text)
                    .focused($focus, equals: field)
                    .font(.system(size: 16, weight: .medium))
                    .foregroundStyle(Theme.ink)
            }
            .padding(.horizontal, 14)
            .frame(minHeight: 50)
            .background(.white, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous)
                .strokeBorder(error == nil ? Theme.line : Theme.copper, lineWidth: error == nil ? 1 : 1.5))
            if let error {
                Text(error).font(.system(size: 12.5, weight: .semibold)).foregroundStyle(Theme.copperInk)
            }
        }
    }

    // MARK: أفعال

    private func setup() {
        phone = orders.phone
        name = orders.name
        if let a = orders.address {
            details = a.details
            center = a.coordinate
            position = .region(MKCoordinateRegion(center: a.coordinate, latitudinalMeters: 450, longitudinalMeters: 450))
        } else if zone.count >= 3 {
            let lats = zone.map(\.latitude), lngs = zone.map(\.longitude)
            let c = CLLocationCoordinate2D(latitude: (lats.min()! + lats.max()!) / 2, longitude: (lngs.min()! + lngs.max()!) / 2)
            center = c
            position = .region(MKCoordinateRegion(center: c, span: MKCoordinateSpan(
                latitudeDelta: (lats.max()! - lats.min()!) * 1.35, longitudeDelta: (lngs.max()! - lngs.min()!) * 1.35)))
        } else {
            position = .region(MKCoordinateRegion(center: center, latitudinalMeters: 2500, longitudinalMeters: 2500))
        }
    }

    private func locate() {
        guard !locating else { return }
        locating = true
        locator.fetch { result in
            locating = false
            switch result {
            case .success(let c):
                withAnimation(.smooth(duration: 0.6)) {
                    position = .region(MKCoordinateRegion(center: c, latitudinalMeters: 350, longitudinalMeters: 350))
                }
            case .denied:
                locationDenied = true
            case .failed:
                Haptics.warning()
            }
        }
    }

    private func save() {
        guard let normalized = OrderCenter.normalizedPhone(phone) else {
            phoneError = "اكتب رقم جوال سعودي صحيح، مثل 05XXXXXXXX"
            focus = .phone
            Haptics.warning()
            return
        }
        guard inside else { Haptics.warning(); return }
        orders.save(address: DeliveryAddress(lat: center.latitude, lng: center.longitude,
                                             details: details.trimmingCharacters(in: .whitespacesAndNewlines)),
                    phone: normalized, name: name)
        Haptics.selected()
        dismiss()
        onSaved()
    }
}

/// موقع الجوال مرة وحدة (بإذن «أثناء الاستخدام» بس)
final class LocationFetcher: NSObject, CLLocationManagerDelegate {
    enum Result { case success(CLLocationCoordinate2D), denied, failed }
    private let manager = CLLocationManager()
    private var completion: ((Result) -> Void)?

    override init() {
        super.init()
        manager.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyNearestTenMeters
    }

    func fetch(_ completion: @escaping (Result) -> Void) {
        self.completion = completion
        switch manager.authorizationStatus {
        case .notDetermined: manager.requestWhenInUseAuthorization()
        case .denied, .restricted: finish(.denied)
        default: manager.requestLocation()
        }
    }

    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        guard completion != nil else { return }
        switch manager.authorizationStatus {
        case .authorizedWhenInUse, .authorizedAlways: manager.requestLocation()
        case .denied, .restricted: finish(.denied)
        default: break
        }
    }

    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        if let c = locations.last?.coordinate { finish(.success(c)) }
    }

    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        finish(.failed)
    }

    private func finish(_ result: Result) {
        let done = completion
        completion = nil
        DispatchQueue.main.async { done?(result) }
    }
}
