import { useState } from 'react'
import Ionicons from '@expo/vector-icons/Ionicons'
import { ActivityIndicator, ImageBackground, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { dropzoneFetch } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { colors, spacing } from '@/theme/tokens'
import { ScreenProps } from '@/types/dropzone'

type CreateTeamResponse = {
  account?: { id?: string }
  linked?: boolean
}

export function TeamCreateScreen({ onNavigate, onSelectTeam }: ScreenProps) {
  const auth = useAuth()
  const [name, setName] = useState('')
  const [username, setUsername] = useState('')
  const [tag, setTag] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function submit() {
    if (!name.trim() || !username.trim() || !tag.trim() || saving) return
    const token = auth.session?.access_token
    if (!token) return
    setSaving(true)
    setError('')
    try {
      const response = await dropzoneFetch<CreateTeamResponse>('/api/auth/register', {
        method: 'POST',
        accessToken: token,
        body: JSON.stringify({
          profile_type: 'equipe',
          username: username.trim().replace(/^@/, ''),
          name: name.trim(),
          media_url: '',
          password: '',
          confirm_password: '',
          verification_code: '',
          details: { tag: tag.trim().toUpperCase() },
          link_existing: true,
        }),
      })
      await auth.refreshAccounts()
      const teamId = String(response.account?.id || '')
      if (teamId) {
        auth.setActiveAccountId(teamId)
        onSelectTeam?.(teamId)
      } else {
        onNavigate('team_directory')
      }
    } catch (err: any) {
      setError(err?.message || 'Não foi possível criar a equipe.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <ImageBackground source={require('../../assets/directory-equipes.png')} style={styles.hero} imageStyle={styles.heroImage}>
        <View style={styles.heroShade} />
        <TouchableOpacity style={styles.back} onPress={() => onNavigate('team_directory')}>
          <Ionicons name="arrow-back" size={20} color={colors.surface} />
        </TouchableOpacity>
        <View style={styles.heroCopy}>
          <Text style={styles.heroEyebrow}>Nova equipe</Text>
          <Text style={styles.heroTitle}>Criar equipe</Text>
        </View>
      </ImageBackground>

      <View style={styles.form}>
        <TextInput value={name} onChangeText={setName} placeholder="Nome da equipe" placeholderTextColor="#8b857d" style={styles.input} />
        <TextInput value={tag} onChangeText={(value) => setTag(value.toUpperCase())} placeholder="TAG" placeholderTextColor="#8b857d" style={styles.input} maxLength={10} autoCapitalize="characters" />
        <TextInput value={username} onChangeText={setUsername} placeholder="Usuário da equipe" placeholderTextColor="#8b857d" style={styles.input} autoCapitalize="none" />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity
          style={[styles.submit, (!name.trim() || !username.trim() || !tag.trim() || saving) && styles.disabled]}
          disabled={!name.trim() || !username.trim() || !tag.trim() || saving}
          onPress={() => void submit()}
        >
          {saving ? <ActivityIndicator color={colors.surface} size="small" /> : <Ionicons name="shield-checkmark-outline" size={19} color={colors.surface} />}
          <Text style={styles.submitText}>{saving ? 'Criando...' : 'Criar equipe'}</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: spacing.lg },
  hero: { height: 132, justifyContent: 'center', overflow: 'hidden', backgroundColor: '#071528' },
  heroImage: { resizeMode: 'cover' },
  heroShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(3,9,18,.52)' },
  back: { position: 'absolute', left: 12, top: 12, width: 36, height: 36, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(7,12,20,.66)', borderWidth: 1, borderColor: 'rgba(255,255,255,.24)' },
  heroCopy: { alignItems: 'center' },
  heroEyebrow: { color: 'rgba(255,255,255,.76)', fontSize: 9, fontWeight: '900', letterSpacing: 1.4, textTransform: 'uppercase' },
  heroTitle: { marginTop: 4, color: colors.surface, fontSize: 28, fontWeight: '900', textTransform: 'uppercase' },
  form: { margin: spacing.md, gap: 9 },
  input: { height: 46, paddingHorizontal: 12, color: colors.ink, backgroundColor: '#ebe6dd', borderWidth: 1, borderColor: '#d2cbc1', fontSize: 13, fontWeight: '700' },
  error: { padding: 10, color: '#9a3412', backgroundColor: '#fff7ed', fontSize: 11, fontWeight: '800' },
  submit: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.brandDark },
  submitText: { color: colors.surface, fontSize: 12, fontWeight: '900', textTransform: 'uppercase' },
  disabled: { opacity: .5 },
})
