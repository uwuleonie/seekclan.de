// Kuratierte Länderliste für /geo (Quelle der Wahrheit für Namen, Kontinente, Regionen, Hauptstädte).
// Daraus erzeugt scripts/geo/build-layers.mjs die Datei app/geo/_data/world.ts.
//
// Format je Zeile: ISO3 (wie in Natural Earth ADM0_A3) | deutscher Name | Kontinente (Komma) | Region | Hauptstadt | Suchname in Natural Earth (optional) | Alternativnamen (Komma, optional)
// Kontinent-Schlüssel: europa, asien, afrika, nordamerika, suedamerika, ozeanien
// Hauptstädte: Stand 2026 laut Länderinformationen des Auswärtigen Amts / Wikipedia "Liste der Hauptstädte der Erde".

export const COUNTRIES_RAW = `
ALB|Albanien|europa|suedost|Tirana||
AND|Andorra|europa|sued|Andorra la Vella||
AUT|Österreich|europa|mittel|Wien||
BEL|Belgien|europa|west|Brüssel||
BIH|Bosnien und Herzegowina|europa|suedost|Sarajevo||Bosnien
BGR|Bulgarien|europa|suedost|Sofia||
HRV|Kroatien|europa|suedost|Zagreb||
CYP|Zypern|europa,asien|sued|Nikosia||
CZE|Tschechien|europa|mittel|Prag||Tschechische Republik
DNK|Dänemark|europa|nord|Kopenhagen||
EST|Estland|europa|nord|Tallinn||
FIN|Finnland|europa|nord|Helsinki||
FRA|Frankreich|europa|west|Paris||
DEU|Deutschland|europa|mittel|Berlin||
GRC|Griechenland|europa|suedost|Athen||
HUN|Ungarn|europa|mittel|Budapest||
ISL|Island|europa|nord|Reykjavík||
IRL|Irland|europa|west|Dublin||
ITA|Italien|europa|sued|Rom||
KOS|Kosovo|europa|suedost|Pristina||
LVA|Lettland|europa|nord|Riga||
LIE|Liechtenstein|europa|mittel|Vaduz||
LTU|Litauen|europa|nord|Vilnius||
LUX|Luxemburg|europa|west|Luxemburg||
MLT|Malta|europa|sued|Valletta||
MDA|Moldau|europa|ost|Chișinău|Kischinau|Moldawien,Republik Moldau
MCO|Monaco|europa|west|Monaco||
MNE|Montenegro|europa|suedost|Podgorica||
NLD|Niederlande|europa|west|Amsterdam||Holland
MKD|Nordmazedonien|europa|suedost|Skopje||Mazedonien
NOR|Norwegen|europa|nord|Oslo||
POL|Polen|europa|mittel|Warschau||
PRT|Portugal|europa|sued|Lissabon||
ROU|Rumänien|europa|suedost|Bukarest||
RUS|Russland|europa,asien|ost|Moskau||Russische Föderation
SMR|San Marino|europa|sued|San Marino||
SRB|Serbien|europa|suedost|Belgrad||
SVK|Slowakei|europa|mittel|Bratislava||
SVN|Slowenien|europa|suedost|Ljubljana|Laibach|
ESP|Spanien|europa|sued|Madrid||
SWE|Schweden|europa|nord|Stockholm||
CHE|Schweiz|europa|mittel|Bern||
UKR|Ukraine|europa|ost|Kiew||Kyjiw
GBR|Vereinigtes Königreich|europa|west|London||Großbritannien,UK,England
VAT|Vatikanstadt|europa|sued|Vatikanstadt|Vatikanstadt|Vatikan
BLR|Belarus|europa|ost|Minsk||Weißrussland
TUR|Türkei|europa,asien|vorderasien|Ankara||
GEO|Georgien|europa,asien|kaukasus|Tiflis||
ARM|Armenien|europa,asien|kaukasus|Jerewan||
AZE|Aserbaidschan|europa,asien|kaukasus|Baku||
KAZ|Kasachstan|europa,asien|zentral|Astana||
AFG|Afghanistan|asien|sued|Kabul||
BHR|Bahrain|asien|vorderasien|Manama||
BGD|Bangladesch|asien|sued|Dhaka|Dhaka|Dakka
BTN|Bhutan|asien|sued|Thimphu||
BRN|Brunei|asien|suedost|Bandar Seri Begawan||
KHM|Kambodscha|asien|suedost|Phnom Penh||
CHN|China|asien|ost|Peking||Volksrepublik China,Beijing
IND|Indien|asien|sued|Neu-Delhi||
IDN|Indonesien|asien|suedost|Jakarta||
IRN|Iran|asien|vorderasien|Teheran||
IRQ|Irak|asien|vorderasien|Bagdad||
ISR|Israel|asien|vorderasien|Jerusalem||
JPN|Japan|asien|ost|Tokio||Tokyo
JOR|Jordanien|asien|vorderasien|Amman||
KWT|Kuwait|asien|vorderasien|Kuwait-Stadt|Kuwait|
KGZ|Kirgisistan|asien|zentral|Bischkek||
LAO|Laos|asien|suedost|Vientiane||
LBN|Libanon|asien|vorderasien|Beirut||
MYS|Malaysia|asien|suedost|Kuala Lumpur||
MDV|Malediven|asien|sued|Malé||
MNG|Mongolei|asien|ost|Ulaanbaatar|Ulan Bator|Ulan Bator
MMR|Myanmar|asien|suedost|Naypyidaw||Birma,Burma
NPL|Nepal|asien|sued|Kathmandu||
PRK|Nordkorea|asien|ost|Pjöngjang||
OMN|Oman|asien|vorderasien|Maskat||
PAK|Pakistan|asien|sued|Islamabad||
PSX|Palästina|asien|vorderasien|Ramallah||Palästinensische Gebiete
PHL|Philippinen|asien|suedost|Manila||
QAT|Katar|asien|vorderasien|Doha||
SAU|Saudi-Arabien|asien|vorderasien|Riad||
SGP|Singapur|asien|suedost|Singapur||
KOR|Südkorea|asien|ost|Seoul||
LKA|Sri Lanka|asien|sued|Sri Jayewardenepura Kotte||Kotte
SYR|Syrien|asien|vorderasien|Damaskus||
TWN|Taiwan|asien|ost|Taipeh||Republik China
TJK|Tadschikistan|asien|zentral|Duschanbe||
THA|Thailand|asien|suedost|Bangkok||
TLS|Osttimor|asien|suedost|Dili||Timor-Leste
TKM|Turkmenistan|asien|zentral|Aşgabat|Aschgabat|Aschgabat
ARE|Vereinigte Arabische Emirate|asien|vorderasien|Abu Dhabi||VAE,Emirate
UZB|Usbekistan|asien|zentral|Taschkent||
VNM|Vietnam|asien|suedost|Hanoi||
YEM|Jemen|asien|vorderasien|Sanaa||
DZA|Algerien|afrika|nord|Algier||
AGO|Angola|afrika|sued|Luanda||
BEN|Benin|afrika|west|Porto-Novo||
BWA|Botswana|afrika|sued|Gaborone||
BFA|Burkina Faso|afrika|west|Ouagadougou||
BDI|Burundi|afrika|ost|Gitega||
CPV|Kap Verde|afrika|west|Praia||Cabo Verde
CMR|Kamerun|afrika|zentral|Yaoundé|Jaunde|Jaunde
CAF|Zentralafrikanische Republik|afrika|zentral|Bangui||Zentralafrika
TCD|Tschad|afrika|zentral|N'Djamena||
COM|Komoren|afrika|ost|Moroni||
COD|Demokratische Republik Kongo|afrika|zentral|Kinshasa||Kongo-Kinshasa,DR Kongo
COG|Republik Kongo|afrika|zentral|Brazzaville||Kongo-Brazzaville,Kongo
CIV|Elfenbeinküste|afrika|west|Yamoussoukro||Côte d'Ivoire
DJI|Dschibuti|afrika|ost|Dschibuti||
EGY|Ägypten|afrika|nord|Kairo||
GNQ|Äquatorialguinea|afrika|zentral|Malabo||
ERI|Eritrea|afrika|ost|Asmara||
SWZ|Eswatini|afrika|sued|Mbabane||Swasiland
ETH|Äthiopien|afrika|ost|Addis Abeba||
GAB|Gabun|afrika|zentral|Libreville||
GMB|Gambia|afrika|west|Banjul||
GHA|Ghana|afrika|west|Accra||
GIN|Guinea|afrika|west|Conakry||
GNB|Guinea-Bissau|afrika|west|Bissau||
KEN|Kenia|afrika|ost|Nairobi||
LSO|Lesotho|afrika|sued|Maseru||
LBR|Liberia|afrika|west|Monrovia||
LBY|Libyen|afrika|nord|Tripolis||
MDG|Madagaskar|afrika|ost|Antananarivo||
MWI|Malawi|afrika|ost|Lilongwe||
MLI|Mali|afrika|west|Bamako||
MRT|Mauretanien|afrika|west|Nouakchott||
MUS|Mauritius|afrika|ost|Port Louis||
MAR|Marokko|afrika|nord|Rabat||
MOZ|Mosambik|afrika|ost|Maputo||
NAM|Namibia|afrika|sued|Windhoek||
NER|Niger|afrika|west|Niamey||
NGA|Nigeria|afrika|west|Abuja||
RWA|Ruanda|afrika|ost|Kigali||
STP|São Tomé und Príncipe|afrika|zentral|São Tomé||
SEN|Senegal|afrika|west|Dakar||
SYC|Seychellen|afrika|ost|Victoria||
SLE|Sierra Leone|afrika|west|Freetown||
SOM|Somalia|afrika|ost|Mogadischu||
ZAF|Südafrika|afrika|sued|Pretoria||
SDS|Südsudan|afrika|ost|Juba||
SDN|Sudan|afrika|nord|Khartum||
TZA|Tansania|afrika|ost|Dodoma||
TGO|Togo|afrika|west|Lomé||
TUN|Tunesien|afrika|nord|Tunis||
UGA|Uganda|afrika|ost|Kampala||
ZMB|Sambia|afrika|sued|Lusaka||
ZWE|Simbabwe|afrika|sued|Harare||
ATG|Antigua und Barbuda|nordamerika|karibik|Saint John's|St. John's|
BHS|Bahamas|nordamerika|karibik|Nassau||
BRB|Barbados|nordamerika|karibik|Bridgetown||
BLZ|Belize|nordamerika|mittel|Belmopan||
CAN|Kanada|nordamerika|nord|Ottawa||
CRI|Costa Rica|nordamerika|mittel|San José||
CUB|Kuba|nordamerika|karibik|Havanna||
DMA|Dominica|nordamerika|karibik|Roseau||
DOM|Dominikanische Republik|nordamerika|karibik|Santo Domingo||
SLV|El Salvador|nordamerika|mittel|San Salvador||
GRD|Grenada|nordamerika|karibik|St. George's|Saint George's|
GTM|Guatemala|nordamerika|mittel|Guatemala-Stadt|Guatemala|
HTI|Haiti|nordamerika|karibik|Port-au-Prince||
HND|Honduras|nordamerika|mittel|Tegucigalpa||
JAM|Jamaika|nordamerika|karibik|Kingston||
MEX|Mexiko|nordamerika|mittel|Mexiko-Stadt||
NIC|Nicaragua|nordamerika|mittel|Managua||
PAN|Panama|nordamerika|mittel|Panama-Stadt|Panama|
KNA|St. Kitts und Nevis|nordamerika|karibik|Basseterre||
LCA|St. Lucia|nordamerika|karibik|Castries||
VCT|St. Vincent und die Grenadinen|nordamerika|karibik|Kingstown||
TTO|Trinidad und Tobago|nordamerika|karibik|Port of Spain||
USA|Vereinigte Staaten|nordamerika|nord|Washington, D.C.|Washington, D.C.|USA,Amerika,Vereinigte Staaten von Amerika
ARG|Argentinien|suedamerika|sued|Buenos Aires||
BOL|Bolivien|suedamerika|anden|Sucre||
BRA|Brasilien|suedamerika|ost|Brasília||
CHL|Chile|suedamerika|sued|Santiago de Chile||
COL|Kolumbien|suedamerika|anden|Bogotá||
ECU|Ecuador|suedamerika|anden|Quito||
GUY|Guyana|suedamerika|nord|Georgetown||
PRY|Paraguay|suedamerika|sued|Asunción||
PER|Peru|suedamerika|anden|Lima||
SUR|Suriname|suedamerika|nord|Paramaribo||
URY|Uruguay|suedamerika|sued|Montevideo||
VEN|Venezuela|suedamerika|nord|Caracas||
AUS|Australien|ozeanien|aunz|Canberra||
FJI|Fidschi|ozeanien|melanesien|Suva||
KIR|Kiribati|ozeanien|mikronesien|South Tarawa|Tarawa|
MHL|Marshallinseln|ozeanien|mikronesien|Majuro||
FSM|Mikronesien|ozeanien|mikronesien|Palikir||Föderierte Staaten von Mikronesien
NRU|Nauru|ozeanien|mikronesien|Yaren||
NZL|Neuseeland|ozeanien|aunz|Wellington||
PLW|Palau|ozeanien|mikronesien|Ngerulmud|Melekeok|
PNG|Papua-Neuguinea|ozeanien|melanesien|Port Moresby||
WSM|Samoa|ozeanien|polynesien|Apia||
SLB|Salomonen|ozeanien|melanesien|Honiara||
TON|Tonga|ozeanien|polynesien|Nukuʻalofa|Nuku'alofa|
TUV|Tuvalu|ozeanien|polynesien|Funafuti||
VUT|Vanuatu|ozeanien|melanesien|Port Vila||
`

/** Fehlt eine Hauptstadt in Natural Earth, nehmen wir diese Koordinaten [Länge, Breite] */
export const CAPITAL_FALLBACK = {
  PLW: [134.62, 7.50],
  NRU: [166.92, -0.55],
  BDI: [29.92, -3.43],
  KIR: [172.98, 1.33],
  FSM: [158.16, 6.92],
  TUV: [179.19, -8.52],
  MHL: [171.38, 7.10],
  VAT: [12.453, 41.904],
  SMR: [12.447, 43.936],
  MCO: [7.42, 43.735],
  LIE: [9.52, 47.14],
  AND: [1.52, 42.51],
  MLT: [14.51, 35.90],
  SGP: [103.85, 1.29],
  BHR: [50.58, 26.22],
  SDS: [31.58, 4.85],
}