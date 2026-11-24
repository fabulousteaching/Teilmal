# Teilmal mit Anmeldung einrichten

(Teilmal hiess früher «Einmaleins». Tabellen und SQL-Datei heissen weiterhin `einmaleins_…` bzw. `einmaleins.sql`.)

Teilmal benutzt **dasselbe Supabase-Projekt wie Vokaboom**. Die Adresse und der öffentliche Schlüssel stehen schon in `js/config.js`.
Lehrpersonen melden sich deshalb mit ihrem Vokaboom-Konto an (gleiche E-Mail-Adresse, gleiches Passwort). Neue Lehrpersonen können sich in Teilmal auch neu registrieren.

Teilmal hat eigene Tabellen (alle beginnen mit `einmaleins_`). Das SQL-Skript ändert nichts an den Tabellen und Daten von Vokaboom. Einzige gewollte Verbindung: Gibst du einem aus Vokaboom übernommenen Kind in Teilmal neue Bilder, gelten diese auch in Vokaboom (es ist ja dasselbe Kärtchen).

Alle Übungen und Spiele funktionieren auch ohne diese Einrichtung. Es braucht sie nur für Klassen, Kinder-Logins und die Übersicht.

## 1. Tabellen anlegen (einmalig, nach Änderungen nochmals)

1. Auf supabase.com das Projekt von Vokaboom öffnen.
2. Links **SQL Editor** öffnen, **New query**.
3. Den ganzen Inhalt von `supabase/einmaleins.sql` einfügen und **Run** klicken.
4. Es erscheint «Success. No rows returned». Mehrmals ausführen schadet nicht, bestehende Klassen und Übungsstände bleiben erhalten.

Hast du die Datei schon einmal ausgeführt, bevor es die Übernahme aus Vokaboom gab? Dann einfach nochmals ganz ausführen. Bis dahin zeigt Teilmal bei „Aus Vokaboom übernehmen“ einen Hinweis.

**Neu: Passwörter für Kinder** (wie in Vokaboom: Passwort pro Kind und Klassenpasswort). Dafür `supabase/einmaleins.sql` **nochmals ganz** ausführen – bestehende Kinder bekommen dabei automatisch ein Passwort, ihre Bilder bleiben gleich. Für Kärtchen-Einstellungen, die in beiden Tools gelten, und Bonus-Münzen für Teilmal-Kinder zusätzlich `supabase/avatar.sql` nochmals ausführen.

**Neu: Bestenlisten der Spiele.** Dafür braucht es eine zusätzliche Tabelle (`einmaleins_scores`). Hast du die Datei vor dieser Neuerung ausgeführt, führe sie einfach **nochmals ganz** aus (auch nötig, damit das Spiel „Zielscheibe“ in der Bestenliste erscheint; weitere neue Spiele brauchen danach keine SQL-Änderung mehr). Bis dahin funktionieren alle Spiele, nur die Bestenliste wird nicht angezeigt (die Klassenübersicht zeigt dann einen Hinweis).

## 2. Adresse von Teilmal erlauben

**Authentication → URL Configuration → Redirect URLs**: die Adresse von Teilmal hinzufügen, z. B.

- `https://teilmal.fabulousteaching.ch/**`
- und `https://fabulousteaching.github.io/Einmaleins/**`
- die alte Adresse `https://einmaleins.fabulousteaching.ch/**` darf stehen bleiben (sie leitet auf die neue weiter)

Die **Site URL** bleibt die von Vokaboom. Dorthin bzw. zu Teilmal führen die Links in E-Mails (Konto bestätigen, Passwort vergessen). Ohne diesen Eintrag landen solche Links auf Vokaboom; das Anmelden mit E-Mail und Passwort funktioniert aber trotzdem.

Fertig. Oben rechts **Anmelden → Ich bin Lehrperson**.

## Klassen und Kinder-Logins

- **Klasse anlegen**, dann **Kinder** eintragen (Vorname und erster Buchstabe des Nachnamens, einzeln oder als Liste). Gespeichert wird nur der Vorname und der erste Buchstabe des Nachnamens.
- **Mit Vokaboom verbinden (beide Richtungen):** auf der Seite „Meine Klassen“ eine Vokaboom-Klasse übernehmen, oder in einer Teilmal-Klasse unter „Kinder“ mit einer Vokaboom-Klasse verbinden bzw. sie in Vokaboom neu anlegen. Danach hat jedes Kind in beiden Tools denselben Benutzernamen und dieselben 3 Bilder – ein Kärtchen.
  - Neue Kinder in Teilmal werden sofort auch in Vokaboom angelegt. Neue Kinder in Vokaboom kommen nach Teilmal, sobald du die Klasse in Teilmal öffnest oder sich das Kind in Teilmal anmeldet.
  - Gleichnamige Kinder (gleicher Vorname und Anfangsbuchstabe) werden nicht doppelt angelegt, sondern verbunden; dann gilt das Vokaboom-Kärtchen, der Übungsstand bleibt.
  - Es gelten immer die aktuellen Bilder aus Vokaboom; „Neue Bilder“ in Teilmal ändert sie auch dort.
  - Löschen in Teilmal: „Nur in Teilmal“ (das Kind bleibt in Vokaboom und wird nicht automatisch wieder geholt; „… hier gelöschte wieder holen“ holt es zurück) oder „Auch in Vokaboom“.
- Neue Kinder bekommen einen Benutzernamen, den es in keinem der beiden Tools gibt.
- Jedes Kind bekommt einen **Benutzernamen** (z. B. `Baum34`, nie doppelt vergeben), ein **Bilder-Passwort** aus 3 Bildern und ein **Passwort zum Eintippen** („Teich23“) – genau wie bei Vokaboom. Dazu kannst du pro Klasse ein **Klassenpasswort** festlegen (Menü → Login-Kärtchen).
- **Reihen**: kleines oder grosses Einmaleins, welche Reihen und Aufgabenarten die Klasse übt und wie viele Rechnungen eine Runde hat. Diese Einstellungen sind Teil der Klasse; dafür muss das SQL-Skript nicht nochmals ausgeführt werden.
- **Kärtchen**: als PDF herunterladen (10 pro A4-Seite), ausdrucken, ausschneiden. Die Kärtchen haben kein Logo und sind in Teilmal und Vokaboom gleich, auch die Einstellungen unter „Kärtchen anpassen“ (Bilder, Passwort pro Kind oder Klassenpasswort, Name, QR-Code, Klasse). Damit diese Einstellungen in beiden Tools gelten: `supabase/avatar.sql` nochmals ganz ausführen. Auf dem Kärtchen ist ein QR-Code: Kinder, die in beiden Tools sind, wählen beim Scannen „bei Vokaboom“ oder „bei Teilmal“; die anderen kommen direkt in ihr Tool. Bereits gedruckte Kärtchen mit zwei QR-Codes gelten weiterhin. Ältere Vokaboom-Kärtchen gelten weiterhin.
- **Kind anmelden**: QR-Code auf dem Kärtchen scannen – oder **Anmelden → Ich bin ein Kind**, Benutzernamen eintippen und die 3 Bilder der Reihe nach antippen oder das Passwort eintippen (eigenes oder Klassenpasswort; gross/klein und Leerzeichen spielen keine Rolle). Nach 8 falschen Versuchen ist 5 Minuten Pause. Auf einem Gerät, auf dem eine Lehrperson angemeldet ist, geht das Kinder-Login erst nach dem Abmelden.
- **Kärtchen verloren?** Beim Kind auf das Symbol mit den gekreuzten Pfeilen tippen: Es bekommt neue Bilder, das alte Kärtchen gilt nicht mehr.

## Gemeinsam angemeldet mit Vokaboom

Laufen Vokaboom und Teilmal beide unter fabulousteaching.ch (`vokaboom.fabulousteaching.ch` und `teilmal.fabulousteaching.ch`), teilen sie sich die Anmeldung über Cookies dieser Domain: Wer in einem Tool angemeldet ist (Lehrperson oder Kind), ist es auf demselben Gerät auch im anderen; Abmelden gilt für beide. Dafür muss Teilmal die eigene Adresse haben (siehe README, „Online stellen“). Kinder können ausserdem mit dem Knopf „ABC Vokabeln üben“ / „1×1 Rechnen üben“ direkt angemeldet ins andere Tool wechseln.

## Was gespeichert wird

- Von Lehrpersonen: die E-Mail-Adresse (für die Anmeldung), die Klassen mit ihren Einstellungen.
- Von Kindern: Vorname, erster Buchstabe des Nachnamens, Benutzername, Bilder-Passwort und der Übungsstand (pro Rechnung: wie oft geübt, wie oft falsch, Zeit, die letzten falschen Antworten; Übungstage; Bestleistungen in den Spielen; Münzen). Keine E-Mail-Adressen.
- Spielergebnisse für die Bestenliste (Spiel, Modus, Aufgabenart, Punktzahl bzw. Zeit, Datum). In der Bestenliste sehen die Kinder einer Klasse Vorname und Anfangsbuchstabe der anderen Kinder derselben Klasse – nur für die Top 10 und nur innerhalb der Klasse.
- Ohne Anmeldung bleibt alles im Browser des Geräts.
- Gemeinsames Anmelden: Die Sitzung der Lehrperson und der Anmelde-Schlüssel eines Kindes liegen in Cookies der Domain fabulousteaching.ch (nur für Vokaboom und Teilmal, keine Werbung oder Statistik).
- Die Zugriffsregeln sorgen dafür, dass jede Lehrperson nur ihre eigenen Klassen und Kinder sieht. Kinder können nur ihren eigenen Übungsstand lesen und speichern.

Kläre mit deiner Schule, ob das so erlaubt ist.

## Gut zu wissen

- **Pause bei Gratis-Projekten:** Supabase pausiert Gratis-Projekte nach etwa 7 Tagen ohne Nutzung (das gilt für Vokaboom und Teilmal gemeinsam). Beim Projekt in Supabase **Restore** klicken. Während der Pause meldet Teilmal «Keine Verbindung zum Server»; Üben geht trotzdem, der Stand wird später gemeldet.
- **Passwort vergessen:** wie bei Vokaboom (siehe dort `supabase/ANLEITUNG.md`), es ist dasselbe Konto.
- Ein Kind, eine Klasse oder alle Daten lassen sich auch direkt in Supabase unter **Table Editor** (Tabellen `einmaleins_…`) ansehen oder löschen. Wird eine Klasse gelöscht, sind auch ihre Kinder und deren Übungsstand weg.

## Mein Avatar (gemeinsam mit Vokaboom)

Kinder mit Login-Kärtchen gestalten unter **Mein Avatar** eine eigene Figur. Das Basic-Set ist gratis, besondere Teile kosten Avatar-Münzen. Jede Münze, die ein Kind in den Teilmal-Übungen verdient, kommt zusätzlich aufs Avatar-Konto (die Teilmal-Münzen für die Spiele bleiben, wie sie sind). Verbundene Kinder haben in Teilmal und Vokaboom denselben Avatar und dieselben Avatar-Münzen.

**Einrichten:** `supabase/avatar.sql` einmal im SQL Editor ausführen (gilt für beide Tools). Details: `supabase/AVATAR.md`.


## Wechsel zwischen Vokaboom und Teilmal

- Der Knopf zum anderen Tool (oben rechts, z. B. „1×1 Teilmal“ bzw. „ABC Vokaboom“, und im Menü unter Konto) erscheint erst, wenn sich die Lehrperson **in beiden Tools mindestens einmal angemeldet** hat. Egal, in welchem Tool zuerst.
- Solange sie nur ein Tool nutzt, gibt es keinen Wechsel – weder für sie noch für ihre Kinder.
- Sobald sie beide Tools genutzt hat, können sie und alle ihre Kinder in beide Richtungen wechseln. Fehlt einem Kind das Login im anderen Tool, wird es beim ersten Wechsel dort angelegt (gleicher Benutzername, gleiche Bilder). Gibt es zur Klasse noch keine verbundene Klasse im anderen Tool, entsteht sie automatisch mit demselben Namen.
- Hat die Lehrperson ein Kind im anderen Tool bewusst gelöscht, bekommt es dort kein neues Login.
- Einrichten: `supabase/avatar.sql` und danach `supabase/einmaleins.sql` (Teilmal) in Supabase nochmals ganz ausführen. Wer schon Klassen oder Portionen hat, gilt im jeweiligen Tool als schon angemeldet.

## Spiele sperren (Menü → Spieleinstellungen)

- **Menü → Spieleinstellungen** (oder Klasse → Reihen → „Spieleinstellungen“): Klasse wählen, dann
  - **Ganze Klasse:** Frei · 🔒 Alle Spiele · Einzelne Spiele (die gesperrten Spiele antippen).
  - **Einzelne Kinder:** pro Kind dieselbe Auswahl; kommt zur Klassen-Sperre dazu.
- Die Kinder sehen gesperrte Spiele nicht mehr; sind alle gesperrt, steht bei „Spielen“: „Deine Lehrperson hat die Spiele gerade gesperrt. Üben geht weiter!“ Die Sperre kommt an, sobald das Kind Teilmal neu lädt.
- Jede Spielrunde kostet 1 Münze, auch „Nochmals“.
