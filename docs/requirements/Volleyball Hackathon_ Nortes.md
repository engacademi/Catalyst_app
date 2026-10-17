# **Volleyball Hackathon: Getting Your Spec Started**

Oct 16, 2026

Before any code gets written, you're going to build a clear, tested specification. AI coding agents do exactly what they're told, fast, so every gap or vague requirement turns into a bug at speed. A strong spec is the biggest advantage your team can have.

The plan has four stages:

1. Collect everything the volleyball organization gave you into one folder.

2. Turn it into two clean Markdown files: resources.md and requirements.md.

3. Get grilled by the AI, using Matt Pocock's /grill-with-docs skill, until every decision is made.

4. Generate the spec with /to-spec.

One rule runs through all of it: **you make the decisions, not the AI.** The AI asks good questions and suggests answers. Your job is to think, push back, and own every call.

## **Step 1: Set up the folder structure**

Create this layout inside your hackathon folder:

hackathon/  
  docs/  
    requirements/  
      source/          ← original files from the org, untouched  
      resources.md     ← index of every link and file  
      requirements.md  ← your structured requirements  
    adr/               ← decisions get recorded here

You've already run git init. **Commit after every step in this guide.** That way you can always roll back, and you'll be able to see how your thinking evolved.

## **Step 2: Move everything out of Apple Notes**

Apple Notes is a fine place to collect things, but the AI can't read it. Get the material into the folder:

* **Download every actual file** into docs/requirements/source/: PDFs, example schedules, spreadsheets, rule documents.

* **Keep the originals exactly as they are.** Don't edit, rename heavily, or convert them.

* **Treat the example schedules as gold.** Later they become real test data that proves your scheduler works.

* **Save important web pages as PDFs** into source/, especially anything behind a login or likely to change.

Commit.

## **Step 3: Build resources.md from the links**

Open Claude in your hackathon folder, paste in all the URLs, and use this prompt:

*For each link, open it and add an entry to docs/requirements/resources.md with: title, URL, type (rules, schedule, venue, policy, etc.), and two or three lines on what's in it that matters for a scheduling system. Also list every file in docs/requirements/source/ with a one-line description. If you can't open a page, say so. Don't guess at its contents.*

Then **check the file yourself**:

* Spot-check a few summaries against the real pages.

* Look for pages it couldn't open. Save those as PDFs into source/ if they matter.

* Make sure nothing important is missing.

Commit.

## **Step 4: Build requirements.md**

The rule here is **restate, don't invent.** Every line should trace back to something the organization said, or be clearly marked as your own assumption.

You can ask Claude to draft it from source/ and resources.md using these nine sections:

1. **Problem statement**: two or three sentences on what's broken today and for whom.

2. **Users**: organizer, ref/scorekeeper, coach, player, spectator or parent. What each one needs on tournament day.

3. **Goals and non-goals**: what's in scope for the hackathon, and what's explicitly out (registration, payments, etc.).

4. **Functional requirements**: numbered R-01, R-02, R-03, grouped by user. Each one tagged with its source, like \[org rules PDF, p.3\].

5. **Scheduling rules and constraints**: courts, time windows, match length, rest between matches, ref duties, divisions. This is the core of the problem, so give it room.

6. **Data available**: what inputs exist (team lists, venues, past schedules) and what format they're in.

7. **Assumptions**: anything you're inferring rather than reading. Label these clearly.

8. **Open questions**: things you already know you can't answer.

9. **Success criteria**: what a winning demo shows, and how the organization would judge it.

Then **read every single line** and check each requirement against its source. Anything Claude inferred rather than found moves to Assumptions. Don't skip this. It's where you actually learn the problem.

The numbered IDs matter. Later, the spec, decisions, and tests can all point at R-07, which makes reviews much sharper.

Commit.

## **Step 5 (optional): Research how tournaments run**

The organization's documents say what they want. They usually skip the things everyone in volleyball takes for granted. A bit of research fills that gap. Look into:

* How Ontario tournaments are formatted: pool play, crossovers, playoff brackets.

* Match mechanics: sets per match, points per set, time caps, warm-ups, typical slot lengths.

* Who referees: do teams ref each other's matches between their own games?

* Day-of reality: what happens when matches run late, and how results and changes get reported today.

Put it in docs/requirements/domain-notes.md, **separate from requirements.md**. The organization's documents always win over your research. Where the two disagree, write it down as a question for the organization.

Commit.

## **Step 6: Install the skills**

In your hackathon folder, run:

npx skills@latest add mattpocock/skills

Select at least **grill-with-docs** and **to-spec**. If the installer offers a setup step, run it.

Why grill-with-docs and not plain grill-me? It's the more organized version. As it grills you, it builds a shared vocabulary file (CONTEXT.md) and records your architecture decisions as ADRs in docs/adr/. So you finish with documents, not just a conversation.

## **Step 7: Start the grilling session**

Open Claude Code (or your coding agent) in the hackathon folder so it can read your files. Fill in the brackets and paste this in:

/grill-with-docs

I'm building a volleyball tournament scheduling system for \[association name\] in a hackathon ending \[date\].

Requirements are in docs/requirements/requirements.md, links in docs/requirements/resources.md, and the organization's original documents in docs/requirements/source/. The originals are authoritative: if anything conflicts, they win. docs/requirements/domain-notes.md is background only.

Priorities:  
1\. The scheduling engine and its rules  
2\. Handling matches that run late on the day  
3\. Player and spectator "find my court" views

Start with the highest-risk area.

If a question can only be answered by the organization, don't let me guess. Add it to an "Org questions" section in requirements.md.

The priorities are there for a reason. The scheduler is the hardest part and the part judges will care about most, so it gets grilled first.

## **Step 8: How to answer the grilling**

The AI asks one question at a time and gives you its recommended answer each time. That's the trap: accepting forty reasonable-sounding recommendations isn't designing. Follow these rules:

* **Never just say "yes."** Either explain why you agree, or change the answer.

* **"I don't know" is a good answer.** It becomes a question for the organization. Don't guess.

* **Grill one area per session.** Go in this order: scheduling rules, day-of changes, player and spectator views, then admin and data. Commit between sessions. Long sessions get sloppy; your files carry the memory between them.

* **Read CONTEXT.md and the new ADRs after each session.** If you can't explain a term or decision to a teammate, it isn't settled yet.

* **Don't wrap up early.** Only confirm you're done when every question is either answered or parked as an org question.

## **Step 9: Send your questions to the organization**

Once the "Org questions" list has built up, send it to your contact at the volleyball organization. Sharp, specific questions show them you understand their problem.

When their answers come back, update requirements.md, then run another grilling session on anything that changed. Commit.

## **Step 10: Generate the spec**

When everything is either decided or parked, run:

/to-spec

This turns your requirements, CONTEXT.md, and ADRs into spec files. Read them through, fix anything that doesn't match what you decided, and commit.

These spec files are what get sent out for pressure testing by other AI models. When that feedback comes back, go through each point and mark it **accept**, **reject**, or **later**, with a one-line reason. You're still the one making the calls.

## **Checklist**

* ☐ Folder structure created

* ☐ All org files downloaded into source/

* ☐ resources.md built and checked

* ☐ requirements.md drafted and every line reviewed

* ☐ (Optional) domain-notes.md written

* ☐ Skills installed

* ☐ Grilling: scheduling rules

* ☐ Grilling: day-of changes

* ☐ Grilling: player and spectator views

* ☐ Grilling: admin and data

* ☐ Org questions sent and answers folded in

* ☐ /to-spec run and spec reviewed

* ☐ Committed after every step

Features:

**Main Features:** 

1. **My day: Gives the user all the relevant info happening to them on that day (SMS and email for reminders and changes)**  
2. **Log in feature/create account (native to the app, optional: add google)**  
3.   
   

   

- Start with a shared common landing page.   
- Start with the common landing page. Everyone starts as a spectator, and the initial value add is everything coming to one landing page. Then you get special permissions as you go through the tiered types of users. Does that make sense?  
- We could have a feature where it says "My Saved Events": a calendar feature that takes you through the upcoming events, as well as access to all the teams and leagues that will be participating at each event.Also, it includes the times at which each team is playing, and if you click on each team, it'll take you to their roster and everything like that.  
- App must access location to recommend events near you and accessing scores of games near you  
- 

Courtside Connected

**Challenge Sponsor:** Ontario Volleyball Association

Imagine attending a major volleyball tournament where everything you need is available in one place. You can follow your favourite teams, check upcoming matches, view live results, receive event updates, and explore everything happening at the venue without switching between multiple websites or applications.

Today, that experience is often fragmented. The Ontario Volleyball Association (OVA) wants to reimagine how athletes, coaches, families, and fans experience its major competitions.

### **CHALLENGE STATEMENT**

“How might we use technology to create a personalized, mobile-first digital companion for OVA's major competitions that brings together team rosters, schedules, results, event updates, partners, and event services from multiple systems in one engaging experience?”

### **01 The Challenge**

Imagine attending a major volleyball tournament where everything you need is available in one place. You can follow your favourite teams, check upcoming matches, view live results, receive event updates, and explore everything happening at the venue without switching between multiple websites or applications.

Today, that experience is often fragmented. The Ontario Volleyball Association (OVA) wants to reimagine how athletes, coaches, families, and fans experience its major competitions.

Your challenge is to design and prototype a mobile-first digital event companion that connects information from existing platforms into one seamless, personalized experience.

### **02 Background & Context**

The Ontario Volleyball Association (OVA) is the provincial sport organization responsible for supporting and developing volleyball across Ontario. OVA serves athletes, coaches, referees, clubs, volunteers, families, and fans across indoor, beach, and sitting volleyball. The organization also delivers major competitions, athlete development programs, coaching and officiating initiatives, and membership services.

As part of its broader digital transformation, OVA is working toward a more connected digital ecosystem for membership, registration, competitions, and communications. One opportunity is to improve the experience of attending and following major volleyball events, beginning with the Ontario Championships.

Currently, event information is spread across multiple platforms:

* **Team Rosters:** Clubs submit player information, jersey numbers, and team photos through spreadsheets, emails, and forms.  
*   
* **Schedules & Results:** Competition information is managed through external platforms such as AES, TIMU, and MyTeam.click.  
*   
* **Event Information:** Parking, venue details, announcements, and other updates may be shared through separate channels.  
*   
* **Sponsors & Activities:** Ticketing, merchandise, partner activations, 50/50 draws, and social content may exist across additional platforms.

OVA has previously used an event app to display rosters, sponsor information, and links to other platforms. However, the experience still requires manual administration and leaves participants navigating multiple sources.

The goal is not to replace these existing systems, but to create a connected digital experience that brings their information together.

### **03 The Problem**

Major volleyball competitions involve hundreds of teams, multiple venues, and large amounts of information that participants need throughout an event.

Several challenges make the current experience more complicated than it needs to be:

* **Fragmented Information:** Participants must navigate different websites, apps, and communication channels to find schedules, results, rosters, and event updates.  
*   
* **Limited Personalization:** Fans and families may need to repeatedly search through hundreds of teams or divisions to find information relevant to them.  
*   
* **Duplicate Data Entry:** Clubs and coaches submit roster information separately, while OVA staff manually compile and upload that information into the event app.  
*   
* **Disconnected Systems:** Different competitions use different tournament-management platforms, making it difficult to maintain one consistent experience.  
*   
* **Event Communication:** Announcements, venue updates, parking details, and other important information can be difficult to find quickly.  
*   
* **Long-Term Sustainability:** OVA needs a solution that is practical to maintain without requiring extensive custom development or ongoing technical support.

The opportunity is to create one digital destination that makes events easier to navigate for participants while reducing administrative work for OVA.

### **04 Your Mission**

Design and prototype a mobile-first digital event companion that makes OVA competitions more connected, personalized, and engaging.

Your solution should explore the following three areas:

1. **Create a Personalized Event Experience:** Help athletes, coaches, families, and fans quickly access the information that matters most to them. Your solution could allow users to follow multiple teams or divisions, view personalized schedules and results, access team rosters, and receive relevant event updates. Consider how the experience could help someone attending a busy tournament find the right information in just a few taps.  
2.   
3. **Connect Existing Event Systems:** Explore how information from different platforms could come together without rebuilding the systems that already manage competitions. Your solution should consider how roster information from OVA's registration platform, schedules and results from tournament-management systems, and event content from OVA staff could feed into one experience. The approach should be flexible enough to support different platforms, including AES, TIMU, and MyTeam.click.  
4.   
5. **Simplify Event Management & Engagement:** Help OVA staff manage event information efficiently while creating a more engaging experience for participants. Your solution might include simple tools for publishing announcements, sharing venue updates, managing event content, or highlighting sponsors and partners. Consider how sponsorships, ticketing, merchandise, and other event opportunities could be integrated naturally without disrupting the participant experience.

Think beyond a traditional event app. How could technology create a connected experience that works for participants, organizers, and partners?

### **05 Requirements & Considerations**

Your solution should account for the following:

* **Mobile-First Experience:** Design for people using their phones while attending or following a live sporting event.  
*   
* **Personalization:** Allow users to follow multiple teams or divisions and access schedules, results, and updates relevant to their interests.  
*   
* **Systems Integration:** Demonstrate how information could be collected and displayed from existing platforms using APIs, data feeds, structured exports, embeds, or other appropriate approaches.

* **Flexible Architecture:** Avoid designing around a single competition platform. The solution should be adaptable to different systems without rebuilding the entire application.

* **Reduced Manual Work:** Explore how team rosters, jersey numbers, and photos could flow from OVA's registration system into the event experience without duplicate submissions.

* **Simple Content Management:** Allow non-technical OVA staff to publish announcements and manage event information without developer support.

* **Accessibility:** Follow AODA/WCAG accessibility principles to create an inclusive experience for different users.

* **Privacy & Security:** Collect only necessary information and respect appropriate permissions for participant and team data.

* **Scalability:** Design an approach that could be adapted beyond Ontario Championships to other major indoor and beach volleyball events.

* **Commercial Sustainability:** Consider opportunities for sponsorships, partner activations, or other appropriate revenue sources that could help offset ongoing operating costs.

The goal is to build a connected experience that works with OVA's existing digital ecosystem rather than replacing the systems already in place.

### **06 What to Build**

Your team should develop a functional prototype or proof of concept demonstrating how technology could create a more connected, personalized volleyball event experience.

Possible solutions include:

* **Personalized Event Companion:** A mobile experience where users can follow their favourite teams, view schedules and results, and receive relevant updates.

* **Smart Event Dashboard:** A personalized hub bringing together team rosters, match information, venue details, and announcements.

* **Connected Data Platform:** A solution that brings information from different tournament systems into one experience without duplicating data entry.

* **Event Management Tools:** A simple interface that helps OVA staff publish announcements, manage event content, and reduce manual work.

* **Interactive Fan Experience:** Creative ways to engage spectators through team updates, event activities, sponsor activations, or personalized content.

These are examples, not prescribed solutions. You're encouraged to explore your own approach.

Focus on creating an intuitive, mobile-first experience that could realistically be developed and expanded across OVA events.

### **07 What Success Looks Like**

A strong solution should demonstrate how it could help OVA:

* **Improve the Event Experience:** Create an intuitive, engaging mobile experience that makes information easy to find during busy competitions.

* **Deliver Meaningful Personalization:** Allow users to follow the teams and divisions they care about without repeatedly searching across different platforms.

* **Connect Existing Systems:** Bring information together from multiple sources without duplicating competition-management functionality.

* **Reduce Administrative Work:** Minimize manual roster submissions, duplicate data entry, and unnecessary staff effort.

* **Support Accessible Experiences:** Make event information usable for a broad range of athletes, families, coaches, and spectators.

* **Enable Long-Term Scalability:** Develop an approach that could support different competitions and technology platforms as OVA's digital ecosystem evolves.

* **Create Sustainable Value:** Identify appropriate opportunities for sponsor engagement or revenue that could help offset ongoing operating costs.

The strongest solutions will balance a great participant experience with technical feasibility, ease of maintenance, and long-term value for OVA.

basic brainstorm: what makes a good app? 

A modern app isn't judged merely by whether it functions; it's judged by how little effort it requires to use. 

the baseline: invisible utility 

1. frictionless on-boarding. value-reveal before ever prompting account creation (that’s where the experience is personalized and saved)   
2. all critical interactive elements (navigation, actions, menus) must exist in thumb zone.  
3. meaningful micro animations (loading, likes)   
4. dark mode optimization (might not be in scope but takes careful colour design) 

more invisible utility: 

- light haptic ticks, adaptive text scaling  
- smart in-app search to bypass menu even with fuzzy searches   
- predictive action triggers (competitions today immediately offered on home page)   
- A unified notification center that aggregates schedule changes, roster updates, and personalized invitations into a single feed. 

more considerations around app breaks: 

- local state persists after crash (typed work, half-completed forms, etc)   
- offline use must cache data locally and queue actions to sync back when reconnects.   
- in-context permission requests (not all at the beginning)   
- don’t block minimally destructive actions, provide undo option

**Main Features:** 

1. **My day: Gives the user all the relevant info happening to them on that day (SMS and email for reminders and changes)**  
2. **Log in feature/create account (native to the app, optional: add google)**  
3.   
   

   

- Start with a shared common landing page.   
- Start with the common landing page. Everyone starts as a spectator, and the initial value add is everything coming to one landing page. Then you get special permissions as you go through the tiered types of users. Does that make sense?  
- We could have a feature where it says "My Saved Events": a calendar feature that takes you through the upcoming events, as well as access to all the teams and leagues that will be participating at each event.Also, it includes the times at which each team is playing, and if you click on each team, it'll take you to their roster and everything like that.  
- App must access location to recommend events near you and accessing scores of games near you

