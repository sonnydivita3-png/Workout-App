// Set the look before first paint so there is no flash of the wrong theme.
try {
  var st = (JSON.parse(localStorage.getItem('workout-app-v1')) || {}).state || {}
  var t = st.theme || 'dark'
  if (t === 'auto') t = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  document.documentElement.dataset.theme = t
  document.documentElement.dataset.accent = st.accent || 'lime'
} catch { document.documentElement.dataset.theme = 'dark'; document.documentElement.dataset.accent = 'lime' }
