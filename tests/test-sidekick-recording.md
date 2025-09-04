# Test Plan for Sidekick Recording Feature

## Test Scenarios

### 1. Settings Persistence
- [ ] Open Settings drawer
- [ ] Toggle "Record Sidekick conversations" ON
- [ ] Refresh page
- [ ] Verify setting persists (should be ON)
- [ ] Toggle OFF
- [ ] Refresh page  
- [ ] Verify setting persists (should be OFF)

### 2. Recording OFF (Default)
- [ ] Ensure "Record Sidekick conversations" is OFF
- [ ] Connect Sidekick to a session
- [ ] Use Push-to-Talk and speak a question
- [ ] Wait for Sidekick response
- [ ] Verify: NO conversation appears in Secretary transcript
- [ ] Verify: Secretary resumes after Sidekick completes response
- [ ] Check viewer.html - should see no Sidekick entries

### 3. Recording ON - Voice Input
- [ ] Toggle "Record Sidekick conversations" ON
- [ ] Connect Sidekick to a session
- [ ] Use Push-to-Talk and speak a question
- [ ] Wait for Sidekick response
- [ ] Verify conversation block appears in transcript with:
  - Header: "[Sidekick conversation]"
  - User line: "You: [your question]"
  - Assistant line: "Sidekick: [response]"
- [ ] Verify visual styling (left border, background)
- [ ] Check viewer.html after embedding flush - should see paired entry

### 4. Recording ON - Text Input
- [ ] Toggle "Record Sidekick conversations" ON
- [ ] Connect Sidekick
- [ ] Type a question in text input and press Enter
- [ ] Wait for Sidekick response
- [ ] Verify conversation block appears with both parts
- [ ] Verify Secretary pauses during response (if autopause is ON)

### 5. Secretary Pause/Resume Behavior
- [ ] Enable both "Auto-pause Secretary" and "Record conversations"
- [ ] Start Secretary recording
- [ ] Use Sidekick PTT or text input
- [ ] Verify Secretary pauses immediately
- [ ] Verify Secretary stays paused during entire response
- [ ] Verify Secretary resumes only after response.done
- [ ] Verify no Sidekick audio leaks into Secretary transcript

### 6. Edge Cases
- [ ] Test with empty user input (should not record)
- [ ] Test with assistant error response (should handle gracefully)
- [ ] Test disconnect during response (should clean up state)
- [ ] Test rapid PTT press/release (should not create duplicates)

## Visual Verification
- Conversation blocks should have:
  - Subtle background color (var(--color-surface))
  - Left accent border (3px, var(--color-accent))
  - Small header text with opacity
  - Clear "You:" and "Sidekick:" labels
  - Proper spacing and indentation

## Database Verification
After testing with recording ON:
1. Run embedding flush (wait 3 min or use manual trigger)
2. Check viewer.html
3. Search for test queries
4. Verify Sidekick conversations appear as single blocks with both parts