const {google} = require('googleapis');
const inquirer = require('inquirer');

async function selectEventsForDay (dateString, dailyList) {
  const eventChoices = []
  eventChoices.push({name: dateString, disabled: true})
  dailyList.forEach(({ event, index}) => {
    eventChoices.push({ name: event.summary, value: event })
  })
  const selectedEvents = await inquirer.prompt({
    name: 'events',
    message: `Choose events on ${dateString} to invite yourself to`,
    pageSize: eventChoices.length,
    type: 'checkbox',
    choices: eventChoices
  })
  return selectedEvents.events
}

async function main () {
  // This method looks for the GCLOUD_PROJECT and GOOGLE_APPLICATION_CREDENTIALS
  // environment variables.
  const email = (await inquirer.prompt({name: 'email', message: 'What is your work email address?'})).email
  const auth = await google.auth.getClient({
    // Scopes can be specified either as an array or as a single, space-delimited string.
    //
    scopes: ['https://www.googleapis.com/auth/calendar']
  });

  // obtain the current project Id
  const project = await google.auth.getDefaultProjectId();

  // Fetch the list of GCE zones within a project.
  const calendarApi = google.calendar('v3')
  const calendars = (await calendarApi.calendarList.list({ auth })).data.items

  const calendarChoice = await inquirer.prompt({
    type: 'rawlist',
    name: 'calendar',
    description: 'Which calendar?',
    choices: calendars.map(calendar => calendar.summary)
  })

  const calendar = calendars.find(calendar => calendar.summary === calendarChoice.calendar)
  const events = await calendarApi.events.list({
    auth,
    calendarId: calendar.id,
    singleEvents: true,
    orderBy: 'startTime',
    maxResults: 1000
  })
  const dayMap = new Map
  events.data.items.forEach((event, index) => {
    const date = new Date(event.start.dateTime)
    let dailyList;
    dailyList = dayMap.get(date.toDateString());
    if (!dailyList) {
      dailyList = [];
      dayMap.set(date.toDateString(), dailyList)
    }
    dailyList.push({ event, index })
  })
  let selectedEvents = []
  for (let [dateString, dailyList] of dayMap) {
    selectedEvents = [...selectedEvents, ...await(selectEventsForDay(dateString, dailyList))]
  }
  for (let event of selectedEvents) {
    let invitation = await calendarApi.events.update({
      auth,
      calendarId: calendar.id,
      eventId: event.id,
      requestBody: {
        ...event,
        attendees: [...(event.attendees || []), { email, responseStatus: 'accepted' }]
      }
    })
    console.log(`invited you to ${event.summary}`)
  }
  console.log('done!')
}

main().catch(console.error);
