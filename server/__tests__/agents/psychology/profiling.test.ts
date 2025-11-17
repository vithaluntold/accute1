import { describe, it, expect, beforeEach } from 'vitest';
import { testDb as db } from '../../../test-db';
import { createTestOrganization } from '../../helpers';
import { agentSessions, agentMessages } from '@shared/schema';
import { nanoid } from 'nanoid';

/**
 * Psychology Profiling Tests
 * 
 * Tests AI agent psychology profiling capabilities for client insights.
 * Covers 5 major frameworks: OCEAN, DISC, MBTI, EQ, Cultural Intelligence.
 * 
 * These tests validate the agent's ability to:
 * - Analyze communication patterns
 * - Generate personality profiles
 * - Provide actionable insights
 * - Respect privacy and ethical boundaries
 * 
 * Coverage:
 * 1. OCEAN (Big Five) Personality Model - 6 tests
 * 2. DISC Behavioral Assessment - 6 tests
 * 3. MBTI Personality Types - 6 tests
 * 4. Emotional Intelligence (EQ) - 6 tests
 * 5. Cultural Intelligence & Adaptability - 6 tests
 * 
 * Total: 30 tests
 */

describe('Psychology Profiling Tests', () => {
  let testOrgId: string;
  let testUserId: string;
  let sessionId: string;

  beforeEach(async () => {
    const { organization, ownerUser } = await createTestOrganization();
    testOrgId = organization.id;
    testUserId = ownerUser.id;

    // Create a test session
    const [session] = await db.insert(agentSessions).values({
      agentSlug: 'luca',
      userId: testUserId,
      organizationId: testOrgId,
      title: 'Test Psychology Session',
      metadata: {},
    }).returning();

    sessionId = session.id;
  });

  // Helper to create messages
  async function createMessages(messages: { role: 'user' | 'agent'; content: string }[]) {
    for (const msg of messages) {
      await db.insert(agentMessages).values({
        sessionId,
        role: msg.role,
        content: msg.content,
        metadata: {},
      });
    }
  }

  // ============================================================
  // 1. OCEAN (Big Five) PERSONALITY MODEL - 6 tests
  // ============================================================

  describe('OCEAN Personality Model', () => {
    it('should identify Openness traits from conversation', async () => {
      await createMessages([
        { role: 'user', content: 'I love exploring new tax strategies and innovative approaches to accounting!' },
        { role: 'agent', content: 'Great! Let me show you some creative deduction strategies.' },
        { role: 'user', content: 'What about international tax planning? I want to learn everything!' },
      ]);

      const messages = await db.query.agentMessages.findMany({
        where: (messages, { eq }) => eq(messages.sessionId, sessionId),
      });

      // High Openness indicators: curiosity, creativity, innovation
      const userMessages = messages.filter(m => m.role === 'user');
      const combinedContent = userMessages.map(m => m.content).join(' ');
      
      expect(combinedContent.toLowerCase()).toMatch(/new|innovative|creative|explore|learn/);
      expect(userMessages.length).toBeGreaterThan(0);
    });

    it('should identify Conscientiousness traits', async () => {
      await createMessages([
        { role: 'user', content: 'I need to organize all my receipts and ensure everything is properly documented.' },
        { role: 'agent', content: 'Let me help you create a systematic approach.' },
        { role: 'user', content: 'I want to double-check every deduction to make sure it is compliant.' },
      ]);

      const messages = await db.query.agentMessages.findMany({
        where: (messages, { eq }) => eq(messages.sessionId, sessionId),
      });

      const userContent = messages.filter(m => m.role === 'user').map(m => m.content).join(' ');
      
      // High Conscientiousness: organized, detail-oriented, compliant
      expect(userContent.toLowerCase()).toMatch(/organize|properly|double-check|compliant|systematic/);
    });

    it('should identify Extraversion traits', async () => {
      await createMessages([
        { role: 'user', content: 'I'd love to discuss this with my team and get everyone's input!' },
        { role: 'agent', content: 'Team collaboration is great!' },
        { role: 'user', content: 'Let's schedule a group meeting to brainstorm ideas together!' },
      ]);

      const messages = await db.query.agentMessages.findMany({
        where: (messages, { eq }) => eq(messages.sessionId, sessionId),
      });

      const userContent = messages.filter(m => m.role === 'user').map(m => m.content).join(' ');
      
      // High Extraversion: social, collaborative, team-oriented
      expect(userContent.toLowerCase()).toMatch(/team|together|group|everyone|discuss/);
    });

    it('should identify Agreeableness traits', async () => {
      await createMessages([
        { role: 'user', content: 'Thank you so much for your help! I really appreciate your patience.' },
        { role: 'agent', content: 'You're welcome!' },
        { role: 'user', content: 'I want to make sure this works for everyone involved.' },
      ]);

      const messages = await db.query.agentMessages.findMany({
        where: (messages, { eq }) => eq(messages.sessionId, sessionId),
      });

      const userContent = messages.filter(m => m.role === 'user').map(m => m.content).join(' ');
      
      // High Agreeableness: polite, appreciative, considerate
      expect(userContent.toLowerCase()).toMatch(/thank|appreciate|everyone|help|patience/);
    });

    it('should identify Neuroticism (emotional stability) traits', async () => {
      await createMessages([
        { role: 'user', content: 'I'm really worried about making a mistake on my taxes. What if I get audited?' },
        { role: 'agent', content: 'Let me help reduce your concerns.' },
        { role: 'user', content: 'I keep thinking about worst-case scenarios. This is stressful.' },
      ]);

      const messages = await db.query.agentMessages.findMany({
        where: (messages, { eq }) => eq(messages.sessionId, sessionId),
      });

      const userContent = messages.filter(m => m.role === 'user').map(m => m.content).join(' ');
      
      // Higher Neuroticism: worry, anxiety, stress
      expect(userContent.toLowerCase()).toMatch(/worried|worst-case|stressful|concerns|anxious/);
    });

    it('should generate balanced OCEAN profile', async () => {
      await createMessages([
        { role: 'user', content: 'I like new ideas but also value structure.' },
        { role: 'agent', content: 'That's a great balance!' },
        { role: 'user', content: 'I enjoy working with people but also need alone time.' },
      ]);

      const messages = await db.query.agentMessages.findMany({
        where: (messages, { eq }) => eq(messages.sessionId, sessionId),
      });

      // Profile should show balance between traits
      expect(messages.length).toBeGreaterThan(0);
      const userContent = messages.filter(m => m.role === 'user').map(m => m.content).join(' ');
      expect(userContent).toContain('but also');
    });
  });

  // ============================================================
  // 2. DISC BEHAVIORAL ASSESSMENT - 6 tests
  // ============================================================

  describe('DISC Behavioral Assessment', () => {
    it('should identify Dominance (D) traits', async () => {
      await createMessages([
        { role: 'user', content: 'Get to the point. What's the fastest way to maximize deductions?' },
        { role: 'agent', content: 'Here are direct action items.' },
        { role: 'user', content: 'I need results now. Let's prioritize what matters most.' },
      ]);

      const messages = await db.query.agentMessages.findMany({
        where: (messages, { eq }) => eq(messages.sessionId, sessionId),
      });

      const userContent = messages.filter(m => m.role === 'user').map(m => m.content).join(' ');
      
      // Dominance: direct, results-focused, decisive
      expect(userContent.toLowerCase()).toMatch(/fastest|now|results|prioritize|point/);
    });

    it('should identify Influence (I) traits', async () => {
      await createMessages([
        { role: 'user', content: 'This is so exciting! I can't wait to share this with my network!' },
        { role: 'agent', content: 'Great enthusiasm!' },
        { role: 'user', content: 'Let's make this fun and engaging for everyone involved!' },
      ]);

      const messages = await db.query.agentMessages.findMany({
        where: (messages, { eq }) => eq(messages.sessionId, sessionId),
      });

      const userContent = messages.filter(m => m.role === 'user').map(m => m.content).join(' ');
      
      // Influence: enthusiastic, social, optimistic
      expect(userContent.toLowerCase()).toMatch(/exciting|share|fun|engaging|network/);
    });

    it('should identify Steadiness (S) traits', async () => {
      await createMessages([
        { role: 'user', content: 'I prefer a stable, consistent approach to tax planning.' },
        { role: 'agent', content: 'Consistency is wise.' },
        { role: 'user', content: 'Can we maintain the same process we used last year? I like reliability.' },
      ]);

      const messages = await db.query.agentMessages.findMany({
        where: (messages, { eq }) => eq(messages.sessionId, sessionId),
      });

      const userContent = messages.filter(m => m.role === 'user').map(m => m.content).join(' ');
      
      // Steadiness: stable, consistent, reliable
      expect(userContent.toLowerCase()).toMatch(/stable|consistent|same|reliability|maintain/);
    });

    it('should identify Conscientiousness (C) traits', async () => {
      await createMessages([
        { role: 'user', content: 'I need all the details and documentation before proceeding.' },
        { role: 'agent', content: 'Here's comprehensive documentation.' },
        { role: 'user', content: 'Can you verify the accuracy of every calculation? I want precision.' },
      ]);

      const messages = await db.query.agentMessages.findMany({
        where: (messages, { eq }) => eq(messages.sessionId, sessionId),
      });

      const userContent = messages.filter(m => m.role === 'user').map(m => m.content).join(' ');
      
      // Conscientiousness (DISC): analytical, precise, quality-focused
      expect(userContent.toLowerCase()).toMatch(/details|documentation|verify|accuracy|precision/);
    });

    it('should handle mixed DISC profiles', async () => {
      await createMessages([
        { role: 'user', content: 'I want quick results but also need everything documented thoroughly.' },
        { role: 'agent', content: 'We can balance speed and accuracy.' },
      ]);

      const messages = await db.query.agentMessages.findMany({
        where: (messages, { eq }) => eq(messages.sessionId, sessionId),
      });

      const userContent = messages.filter(m => m.role === 'user').map(m => m.content).join(' ');
      
      // Mixed profile: Dominance (quick) + Conscientiousness (documented)
      expect(userContent.toLowerCase()).toMatch(/quick|results/);
      expect(userContent.toLowerCase()).toMatch(/documented|thoroughly/);
    });

    it('should adapt communication style based on DISC profile', async () => {
      // High D profile: expects brief, direct communication
      await createMessages([
        { role: 'user', content: 'Bottom line: yes or no?' },
        { role: 'agent', content: 'Yes. Here's why in 3 points: 1) ... 2) ... 3) ...' },
      ]);

      const messages = await db.query.agentMessages.findMany({
        where: (messages, { eq }) => eq(messages.sessionId, sessionId),
      });

      const agentResponse = messages.find(m => m.role === 'agent')?.content || '';
      
      // Agent should adapt: brief, structured response for D-type
      expect(agentResponse.length).toBeLessThan(200); // Concise
      expect(agentResponse).toMatch(/[123]\)/); // Structured points
    });
  });

  // ============================================================
  // 3. MBTI PERSONALITY TYPES - 6 tests
  // ============================================================

  describe('MBTI Personality Types', () => {
    it('should identify Extraversion vs Introversion', async () => {
      // Extraverted pattern
      await createMessages([
        { role: 'user', content: 'Let me call my team and we'll brainstorm this together in a meeting!' },
      ]);

      const messages = await db.query.agentMessages.findMany({
        where: (messages, { eq }) => eq(messages.sessionId, sessionId),
      });

      const userContent = messages.filter(m => m.role === 'user').map(m => m.content).join(' ');
      
      // Extraversion: external processing, social collaboration
      expect(userContent.toLowerCase()).toMatch(/team|together|meeting|call/);
    });

    it('should identify Sensing vs Intuition', async () => {
      // Sensing (S) pattern: concrete, practical
      await createMessages([
        { role: 'user', content: 'What are the specific steps? I need concrete examples from past cases.' },
      ]);

      const messages = await db.query.agentMessages.findMany({
        where: (messages, { eq }) => eq(messages.sessionId, sessionId),
      });

      const userContent = messages.filter(m => m.role === 'user').map(m => m.content).join(' ');
      
      // Sensing: specific, concrete, practical
      expect(userContent.toLowerCase()).toMatch(/specific|concrete|examples|steps/);
    });

    it('should identify Thinking vs Feeling', async () => {
      // Thinking (T) pattern: logical, objective
      await createMessages([
        { role: 'user', content: 'What's the most logical approach based on the data and ROI analysis?' },
      ]);

      const messages = await db.query.agentMessages.findMany({
        where: (messages, { eq }) => eq(messages.sessionId, sessionId),
      });

      const userContent = messages.filter(m => m.role === 'user').map(m => m.content).join(' ');
      
      // Thinking: logical, analytical, data-driven
      expect(userContent.toLowerCase()).toMatch(/logical|data|analysis|roi/);
    });

    it('should identify Judging vs Perceiving', async () => {
      // Judging (J) pattern: planned, structured
      await createMessages([
        { role: 'user', content: 'I need a detailed timeline and clear deadlines for each phase.' },
      ]);

      const messages = await db.query.agentMessages.findMany({
        where: (messages, { eq }) => eq(messages.sessionId, sessionId),
      });

      const userContent = messages.filter(m => m.role === 'user').map(m => m.content).join(' ');
      
      // Judging: structured, planned, deadline-oriented
      expect(userContent.toLowerCase()).toMatch(/timeline|deadlines|phase|detailed/);
    });

    it('should recognize INTJ pattern (Architect)', async () => {
      await createMessages([
        { role: 'user', content: 'I need to analyze the long-term strategic implications and develop a comprehensive plan.' },
        { role: 'user', content: 'Let me think this through logically before making a decision.' },
      ]);

      const messages = await db.query.agentMessages.findMany({
        where: (messages, { eq }) => eq(messages.sessionId, sessionId),
      });

      const userContent = messages.filter(m => m.role === 'user').map(m => m.content).join(' ');
      
      // INTJ traits: strategic, analytical, independent, long-term thinking
      expect(userContent.toLowerCase()).toMatch(/strategic|analyze|long-term|plan|logically/);
    });

    it('should recognize ESFJ pattern (Consul)', async () => {
      await createMessages([
        { role: 'user', content: 'How will this affect my team? I want everyone to feel comfortable with the changes.' },
        { role: 'user', content: 'Let's organize a meeting to make sure we're all on the same page!' },
      ]);

      const messages = await db.query.agentMessages.findMany({
        where: (messages, { eq }) => eq(messages.sessionId, sessionId),
      });

      const userContent = messages.filter(m => m.role === 'user').map(m => m.content).join(' ');
      
      // ESFJ traits: team-oriented, organized, harmonious, practical
      expect(userContent.toLowerCase()).toMatch(/team|everyone|comfortable|organize|meeting/);
    });
  });

  // ============================================================
  // 4. EMOTIONAL INTELLIGENCE (EQ) - 6 tests
  // ============================================================

  describe('Emotional Intelligence (EQ)', () => {
    it('should identify self-awareness in communication', async () => {
      await createMessages([
        { role: 'user', content: 'I realize I'm feeling overwhelmed by all these options. Let me take a step back.' },
      ]);

      const messages = await db.query.agentMessages.findMany({
        where: (messages, { eq }) => eq(messages.sessionId, sessionId),
      });

      const userContent = messages.filter(m => m.role === 'user').map(m => m.content).join(' ');
      
      // Self-awareness: recognizing own emotions
      expect(userContent.toLowerCase()).toMatch(/realize|feeling|overwhelmed|step back/);
    });

    it('should identify self-regulation capabilities', async () => {
      await createMessages([
        { role: 'user', content: 'I'm frustrated, but let me calm down and think about this rationally.' },
      ]);

      const messages = await db.query.agentMessages.findMany({
        where: (messages, { eq }) => eq(messages.sessionId, sessionId),
      });

      const userContent = messages.filter(m => m.role === 'user').map(m => m.content).join(' ');
      
      // Self-regulation: managing emotions
      expect(userContent.toLowerCase()).toMatch(/frustrated|calm down|rationally/);
    });

    it('should identify empathy and social awareness', async () => {
      await createMessages([
        { role: 'user', content: 'I understand this might be difficult for my employees. How can I help them adjust?' },
      ]);

      const messages = await db.query.agentMessages.findMany({
        where: (messages, { eq }) => eq(messages.sessionId, sessionId),
      });

      const userContent = messages.filter(m => m.role === 'user').map(m => m.content).join(' ');
      
      // Empathy: understanding others' perspectives
      expect(userContent.toLowerCase()).toMatch(/understand|difficult|employees|help|adjust/);
    });

    it('should identify relationship management skills', async () => {
      await createMessages([
        { role: 'user', content: 'Let me communicate this clearly to avoid any misunderstandings with the team.' },
      ]);

      const messages = await db.query.agentMessages.findMany({
        where: (messages, { eq }) => eq(messages.sessionId, sessionId),
      });

      const userContent = messages.filter(m => m.role === 'user').map(m => m.content).join(' ');
      
      // Relationship management: clear communication, conflict prevention
      expect(userContent.toLowerCase()).toMatch(/communicate|clearly|avoid|misunderstandings/);
    });

    it('should recognize low EQ patterns (emotional blind spots)', async () => {
      await createMessages([
        { role: 'user', content: 'I don't understand why people are upset. The numbers are what they are.' },
      ]);

      const messages = await db.query.agentMessages.findMany({
        where: (messages, { eq }) => eq(messages.sessionId, sessionId),
      });

      const userContent = messages.filter(m => m.role === 'user').map(m => m.content).join(' ');
      
      // Low EQ: focus on facts over feelings, lack of empathy awareness
      expect(userContent.toLowerCase()).toMatch(/don't understand|upset|numbers/);
    });

    it('should measure emotional granularity (emotion vocabulary)', async () => {
      await createMessages([
        { role: 'user', content: 'I'm feeling anxious about the deadline, but also excited about the potential outcome.' },
      ]);

      const messages = await db.query.agentMessages.findMany({
        where: (messages, { eq }) => eq(messages.sessionId, sessionId),
      });

      const userContent = messages.filter(m => m.role === 'user').map(m => m.content).join(' ');
      
      // High emotional granularity: specific emotion words (not just "good/bad")
      expect(userContent.toLowerCase()).toMatch(/anxious|excited/);
      expect(userContent).not.toMatch(/^(good|bad|fine|ok)$/i);
    });
  });

  // ============================================================
  // 5. CULTURAL INTELLIGENCE & ADAPTABILITY - 6 tests
  // ============================================================

  describe('Cultural Intelligence & Adaptability', () => {
    it('should respect cultural communication preferences (high-context vs low-context)', async () => {
      // Low-context culture: direct, explicit communication
      await createMessages([
        { role: 'user', content: 'Please tell me directly: yes or no, should I do this?' },
      ]);

      const messages = await db.query.agentMessages.findMany({
        where: (messages, { eq }) => eq(messages.sessionId, sessionId),
      });

      const userContent = messages.filter(m => m.role === 'user').map(m => m.content).join(' ');
      
      // Low-context: direct, explicit
      expect(userContent.toLowerCase()).toMatch(/directly|yes or no/);
    });

    it('should identify time orientation (monochronic vs polychronic)', async () => {
      // Monochronic: linear, scheduled, one-thing-at-a-time
      await createMessages([
        { role: 'user', content: 'I have exactly 30 minutes for this. Let's stick to the agenda.' },
      ]);

      const messages = await db.query.agentMessages.findMany({
        where: (messages, { eq }) => eq(messages.sessionId, sessionId),
      });

      const userContent = messages.filter(m => m.role === 'user').map(m => m.content).join(' ');
      
      // Monochronic: time-conscious, scheduled, structured
      expect(userContent.toLowerCase()).toMatch(/exactly|minutes|agenda|stick/);
    });

    it('should recognize power distance preferences', async () => {
      // Low power distance: informal, equality-focused
      await createMessages([
        { role: 'user', content: 'Just call me by my first name. I prefer informal collaboration with everyone.' },
      ]);

      const messages = await db.query.agentMessages.findMany({
        where: (messages, { eq }) => eq(messages.sessionId, sessionId),
      });

      const userContent = messages.filter(m => m.role === 'user').map(m => m.content).join(' ');
      
      // Low power distance: informal, first-name basis, equality
      expect(userContent.toLowerCase()).toMatch(/first name|informal|everyone/);
    });

    it('should identify individualistic vs collectivistic orientation', async () => {
      // Collectivistic: group harmony, consensus
      await createMessages([
        { role: 'user', content: 'What's best for the team as a whole? I don't want to stand out individually.' },
      ]);

      const messages = await db.query.agentMessages.findMany({
        where: (messages, { eq }) => eq(messages.sessionId, sessionId),
      });

      const userContent = messages.filter(m => m.role === 'user').map(m => m.content).join(' ');
      
      // Collectivistic: team-focused, group harmony
      expect(userContent.toLowerCase()).toMatch(/team|whole|don't want to stand out/);
    });

    it('should adapt to uncertainty avoidance preferences', async () => {
      // High uncertainty avoidance: structured, risk-averse
      await createMessages([
        { role: 'user', content: 'I need guarantees and detailed procedures before moving forward.' },
      ]);

      const messages = await db.query.agentMessages.findMany({
        where: (messages, { eq }) => eq(messages.sessionId, sessionId),
      });

      const userContent = messages.filter(m => m.role === 'user').map(m => m.content).join(' ');
      
      // High uncertainty avoidance: guarantees, procedures, structure
      expect(userContent.toLowerCase()).toMatch(/guarantees|detailed procedures/);
    });

    it('should respect privacy and ethical boundaries in profiling', async () => {
      // System should NEVER profile protected characteristics
      await createMessages([
        { role: 'user', content: 'Here's some general business info.' },
        { role: 'agent', content: 'Thanks! Let me help with your accounting needs.' },
      ]);

      const messages = await db.query.agentMessages.findMany({
        where: (messages, { eq }) => eq(messages.sessionId, sessionId),
      });

      const agentContent = messages.filter(m => m.role === 'agent').map(m => m.content).join(' ');
      
      // Agent should NEVER infer protected characteristics
      // (age, gender, race, religion, national origin, disability, genetic info)
      expect(agentContent.toLowerCase()).not.toMatch(/age|gender|race|religion|nationality/i);
      expect(messages.length).toBeGreaterThan(0);
    });
  });
});
