import { useState } from 'react';

interface SkillConfig {
  enabled?: boolean;
  apiKey?: string;
  env?: Record<string, string>;
  config?: Record<string, unknown>;
}

interface SkillEditorProps {
  skillId?: string;
  existingConfig?: SkillConfig;
  onSave: (id: string, config: SkillConfig) => void;
  onCancel: () => void;
}

// Bundled skills from clawdbot
const BUNDLED_SKILLS = [
  // Productivity & Notes
  { id: 'apple-notes', name: 'Apple Notes', description: 'Read and create Apple Notes', category: 'productivity' },
  { id: 'apple-reminders', name: 'Apple Reminders', description: 'Manage Apple Reminders', category: 'productivity' },
  { id: 'bear-notes', name: 'Bear Notes', description: 'Access Bear note-taking app', category: 'productivity' },
  { id: 'notion', name: 'Notion', description: 'Interact with Notion workspace', category: 'productivity' },
  { id: 'obsidian', name: 'Obsidian', description: 'Access Obsidian vault', category: 'productivity' },
  { id: 'things-mac', name: 'Things (Mac)', description: 'Manage Things 3 tasks', category: 'productivity' },
  { id: 'trello', name: 'Trello', description: 'Manage Trello boards and cards', category: 'productivity' },

  // Communication
  { id: 'discord', name: 'Discord', description: 'Discord bot integration', category: 'communication' },
  { id: 'slack', name: 'Slack', description: 'Slack workspace integration', category: 'communication' },
  { id: 'imsg', name: 'iMessage', description: 'Send iMessages (macOS)', category: 'communication' },
  { id: 'bluebubbles', name: 'BlueBubbles', description: 'BlueBubbles iMessage bridge', category: 'communication' },
  { id: 'himalaya', name: 'Himalaya Email', description: 'Email via himalaya CLI', category: 'communication' },
  { id: 'wacli', name: 'WhatsApp CLI', description: 'WhatsApp CLI integration', category: 'communication' },

  // Development
  { id: 'github', name: 'GitHub', description: 'GitHub API integration', category: 'development' },
  { id: 'coding-agent', name: 'Coding Agent', description: 'Advanced coding assistance', category: 'development' },
  { id: 'skill-creator', name: 'Skill Creator', description: 'Create new skills', category: 'development' },
  { id: 'mcporter', name: 'MCP Porter', description: 'Port MCP servers to skills', category: 'development' },

  // AI & Media
  { id: 'gemini', name: 'Gemini', description: 'Google Gemini integration', category: 'ai' },
  { id: 'oracle', name: 'Oracle', description: 'Query other AI models', category: 'ai' },
  { id: 'openai-image-gen', name: 'OpenAI Image Gen', description: 'Generate images with DALL-E', category: 'ai' },
  { id: 'openai-whisper', name: 'OpenAI Whisper', description: 'Local speech-to-text', category: 'ai' },
  { id: 'openai-whisper-api', name: 'Whisper API', description: 'OpenAI Whisper API', category: 'ai' },
  { id: 'sherpa-onnx-tts', name: 'Sherpa TTS', description: 'Local text-to-speech', category: 'ai' },

  // Media & Entertainment
  { id: 'spotify-player', name: 'Spotify Player', description: 'Control Spotify playback', category: 'media' },
  { id: 'sonoscli', name: 'Sonos CLI', description: 'Control Sonos speakers', category: 'media' },
  { id: 'songsee', name: 'SongSee', description: 'Identify songs', category: 'media' },
  { id: 'video-frames', name: 'Video Frames', description: 'Extract video frames', category: 'media' },
  { id: 'gifgrep', name: 'GIF Grep', description: 'Search and share GIFs', category: 'media' },
  { id: 'canvas', name: 'Canvas', description: 'Create images and diagrams', category: 'media' },

  // Utilities
  { id: '1password', name: '1Password', description: 'Access 1Password vault', category: 'utilities' },
  { id: 'weather', name: 'Weather', description: 'Get weather forecasts', category: 'utilities' },
  { id: 'peekaboo', name: 'Peekaboo', description: 'Screenshot and screen capture', category: 'utilities' },
  { id: 'camsnap', name: 'CamSnap', description: 'Capture from camera', category: 'utilities' },
  { id: 'goplaces', name: 'GoPlaces', description: 'Search and navigate places', category: 'utilities' },
  { id: 'local-places', name: 'Local Places', description: 'Find nearby places', category: 'utilities' },
  { id: 'openhue', name: 'OpenHue', description: 'Control Philips Hue lights', category: 'utilities' },
  { id: 'tmux', name: 'Tmux', description: 'Tmux terminal multiplexer', category: 'utilities' },

  // Content
  { id: 'summarize', name: 'Summarize', description: 'Summarize text and documents', category: 'content' },
  { id: 'blogwatcher', name: 'Blog Watcher', description: 'Monitor RSS feeds and blogs', category: 'content' },
  { id: 'nano-pdf', name: 'Nano PDF', description: 'Read and extract PDF content', category: 'content' },

  // Other
  { id: 'session-logs', name: 'Session Logs', description: 'Access session history', category: 'system' },
  { id: 'model-usage', name: 'Model Usage', description: 'Track model token usage', category: 'system' },
  { id: 'voice-call', name: 'Voice Call', description: 'Voice call integration', category: 'communication' },
  { id: 'food-order', name: 'Food Order', description: 'Order food delivery', category: 'utilities' },
  { id: 'bird', name: 'Bird', description: 'Twitter/X integration', category: 'communication' },

  // Custom
  { id: 'custom', name: 'Custom Skill', description: 'Configure a custom skill by ID', category: 'custom' },
];

const SKILL_CATEGORIES = [
  { id: 'all', name: 'All' },
  { id: 'productivity', name: 'Productivity' },
  { id: 'communication', name: 'Communication' },
  { id: 'development', name: 'Development' },
  { id: 'ai', name: 'AI & ML' },
  { id: 'media', name: 'Media' },
  { id: 'utilities', name: 'Utilities' },
  { id: 'content', name: 'Content' },
  { id: 'system', name: 'System' },
  { id: 'custom', name: 'Custom' },
];

function SkillEditor({ skillId, existingConfig, onSave, onCancel }: SkillEditorProps) {
  const [selectedSkill, setSelectedSkill] = useState(skillId || '');
  const [customSkillId, setCustomSkillId] = useState('');
  const [enabled, setEnabled] = useState(existingConfig?.enabled ?? true);
  const [apiKey, setApiKey] = useState(existingConfig?.apiKey || '');
  const [envVars, setEnvVars] = useState<Array<{ key: string; value: string }>>(
    Object.entries(existingConfig?.env || {}).map(([key, value]) => ({ key, value }))
  );
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Filter skills based on category and search
  const filteredSkills = BUNDLED_SKILLS.filter((skill) => {
    const matchesCategory = categoryFilter === 'all' || skill.category === categoryFilter;
    const matchesSearch =
      searchQuery === '' ||
      skill.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      skill.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      skill.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const handleSave = () => {
    const finalSkillId = selectedSkill === 'custom' ? customSkillId : selectedSkill;

    if (!finalSkillId) {
      alert('Please select a skill or enter a custom skill ID');
      return;
    }

    const config: SkillConfig = {
      enabled,
    };

    if (apiKey) {
      config.apiKey = apiKey;
    }

    if (envVars.length > 0) {
      config.env = {};
      for (const { key, value } of envVars) {
        if (key.trim()) {
          config.env[key.trim()] = value;
        }
      }
    }

    onSave(finalSkillId, config);
  };

  const addEnvVar = () => {
    setEnvVars([...envVars, { key: '', value: '' }]);
  };

  const removeEnvVar = (index: number) => {
    setEnvVars(envVars.filter((_, i) => i !== index));
  };

  const updateEnvVar = (index: number, field: 'key' | 'value', value: string) => {
    const updated = [...envVars];
    updated[index][field] = value;
    setEnvVars(updated);
  };

  return (
    <div className="wizard-overlay">
      <div className="wizard-modal skill-editor">
        <div className="wizard-header">
          <h2>{skillId ? 'Edit Skill' : 'Add Skill'}</h2>
          <button className="btn-close" onClick={onCancel}>
            ×
          </button>
        </div>

        <div className="wizard-content">
          {!skillId && (
            <>
              {/* Search and filter */}
              <div className="skill-filters">
                <input
                  type="text"
                  className="skill-search"
                  placeholder="Search skills..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <div className="category-tabs">
                  {SKILL_CATEGORIES.map((cat) => (
                    <button
                      key={cat.id}
                      className={`category-tab ${categoryFilter === cat.id ? 'active' : ''}`}
                      onClick={() => setCategoryFilter(cat.id)}
                    >
                      {cat.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Skill grid */}
              <div className="skill-selector-grid">
                {filteredSkills.map((skill) => (
                  <button
                    key={skill.id}
                    className={`skill-option ${selectedSkill === skill.id ? 'selected' : ''}`}
                    onClick={() => setSelectedSkill(skill.id)}
                  >
                    <span className="skill-name">{skill.name}</span>
                    <span className="skill-desc">{skill.description}</span>
                    <span className="skill-category">{skill.category}</span>
                  </button>
                ))}
              </div>

              {/* Custom skill input */}
              {selectedSkill === 'custom' && (
                <div className="form-group">
                  <label>Custom Skill ID</label>
                  <input
                    type="text"
                    value={customSkillId}
                    onChange={(e) => setCustomSkillId(e.target.value)}
                    placeholder="my-custom-skill"
                  />
                </div>
              )}
            </>
          )}

          {(skillId || selectedSkill) && (
            <>
              <div className="form-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={enabled}
                    onChange={(e) => setEnabled(e.target.checked)}
                  />
                  <span>Enabled</span>
                </label>
              </div>

              <div className="form-group">
                <label>API Key (optional)</label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="sk-... (if skill requires authentication)"
                />
                <p className="hint">Some skills require an API key for external services</p>
              </div>

              <div className="form-group">
                <label>Environment Variables</label>
                {envVars.map((env, index) => (
                  <div key={index} className="env-var-row">
                    <input
                      type="text"
                      value={env.key}
                      onChange={(e) => updateEnvVar(index, 'key', e.target.value)}
                      placeholder="KEY"
                    />
                    <span>=</span>
                    <input
                      type="text"
                      value={env.value}
                      onChange={(e) => updateEnvVar(index, 'value', e.target.value)}
                      placeholder="value"
                    />
                    <button
                      className="btn btn-icon btn-danger"
                      onClick={() => removeEnvVar(index)}
                    >
                      ×
                    </button>
                  </div>
                ))}
                <button className="btn btn-secondary btn-small" onClick={addEnvVar}>
                  + Add Variable
                </button>
              </div>
            </>
          )}
        </div>

        <div className="wizard-actions">
          <button className="btn btn-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={handleSave}>
            {skillId ? 'Update Skill' : 'Add Skill'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default SkillEditor;
