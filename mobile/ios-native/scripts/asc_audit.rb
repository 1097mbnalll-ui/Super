# فحص قراءة فقط لصفحة التطبيق في App Store Connect. ما يكتب شي. ما يطبع بيانات شخصية (اسم/إيميل/جوال المراجع)
require "spaceship"
Spaceship::ConnectAPI.token = Spaceship::ConnectAPI::Token.from_json_file("/tmp/asc.json")
def sec(t) puts "\n=== #{t}" end
def safe(t) yield rescue puts("  (#{t} failed: #{$!.class}: #{$!.message[0,160]})") end
app = Spaceship::ConnectAPI::App.find("sa.ohod.store")
sec "APP"; puts "  name=#{app.name} bundle=#{app.bundle_id} primaryLocale=#{app.primary_locale} contentRights=#{app.content_rights_declaration.inspect}"
sec "VERSIONS"
vers = app.get_app_store_versions
vers.each { |v| puts "  version=#{v.version_string} state=#{v.app_store_state} platform=#{v.platform} release=#{v.release_type}" }
v = vers.first
safe("build") do
  r = Spaceship::ConnectAPI.get_app_store_version(app_store_version_id: v.id, includes: "build")
  vv = r.first; b = vv.build
  puts "  attached build: #{b ? "#{b.version} processing=#{b.processing_state} expired=#{b.expired} usesNonExemptEncryption=#{b.uses_non_exempt_encryption.inspect}" : "NONE"}"
end
safe("builds list") { Spaceship::ConnectAPI::Build.all(app_id: app.id, sort: "-uploadedDate", limit: 5).each { |b| puts "  build #{b.version} processing=#{b.processing_state} expired=#{b.expired} uploaded=#{b.uploaded_date}" } }
sec "LOCALIZATIONS"
safe("localizations") do
  v.get_app_store_version_localizations.each do |l|
    puts "  #{l.locale}: description=#{l.description.to_s.length} keywords=#{l.keywords.to_s.length} promo=#{l.promotional_text.to_s.length} support=#{l.support_url} marketing=#{l.marketing_url}"
    l.get_app_screenshot_sets.each do |set|
      shots = set.app_screenshots rescue []
      puts "    screenshots #{set.screenshot_display_type}: #{shots.size} " + shots.map { |x| x.asset_delivery_state && x.asset_delivery_state["state"] }.uniq.inspect
    end
  end
end
sec "APP INFO / LOCALIZED INFO"
safe("app info") do
  info = app.fetch_latest_app_info
  puts "  primaryCategory=#{info.primary_category&.id} secondary=#{info.secondary_category&.id} state=#{info.app_store_state}"
  info.get_app_info_localizations.each { |l| puts "  #{l.locale}: name=#{l.name} subtitle=#{l.subtitle} privacyUrl=#{l.privacy_policy_url}" }
  ar = info.fetch_age_rating_declaration
  puts "  ageRating: " + ar.class.attribute_mapping.keys.map { |k| "#{k}=#{ar.send(k).inspect}" }.join(", ")
end
sec "REVIEW DETAIL (presence only)"
safe("review detail") do
  r = v.fetch_app_store_review_detail
  if r then puts "  contactFirst=#{!r.contact_first_name.to_s.empty?} contactLast=#{!r.contact_last_name.to_s.empty?} phone=#{!r.contact_phone.to_s.empty?} email=#{!r.contact_email.to_s.empty?} demoRequired=#{r.demo_account_required.inspect} notesLen=#{r.notes.to_s.length}" else puts "  NONE" end
end
sec "PRICE / AVAILABILITY"
safe("availability") do
  r = Spaceship::ConnectAPI.get_app_availabilities_v2(app_id: app.id, includes: "territoryAvailabilities") rescue nil
  if r then puts "  availability: #{r.to_json[0, 400]}" else puts "  (availability api not in this fastlane)" end
end
safe("prices") { pr = app.get_app_price_schedule rescue nil; puts "  priceSchedule: #{pr ? "present" : "n/a"}" }
puts "\nAUDIT_DONE"
