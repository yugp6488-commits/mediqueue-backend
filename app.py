import streamlit as st
import random
import pandas as pd
import time

# ------------------ CONFIG ------------------
st.set_page_config(page_title="Retro RPS", layout="centered", page_icon="🕹️")

# ------------------ SESSION STATE ------------------
# Initialize all states if they don't exist
states = {
    "me": 0,
    "bot": 0,
    "result": "READY PLAYER ONE",
    "bot_move": "",
    "user_move": "",
    "history": [{"You": 0, "Bot": 0}],
    "game_over": False
}

for key, value in states.items():
    if key not in st.session_state:
        st.session_state[key] = value

# ------------------ LOGIC ------------------
def play(user_move):
    if st.session_state.game_over:
        return

    choices = ["rock", "paper", "scissor"]
    bot_move = random.choice(choices)
    
    st.session_state.user_move = user_move
    st.session_state.bot_move = bot_move

    # Determine Winner
    if user_move == bot_move:
        st.session_state.result = "⚖️ IT'S A TIE!"
    elif (user_move == "rock" and bot_move == "scissor") or \
         (user_move == "paper" and bot_move == "rock") or \
         (user_move == "scissor" and bot_move == "paper"):
        st.session_state.me += 1
        st.session_state.result = "🔥 YOU WIN THIS ROUND!"
    else:
        st.session_state.bot += 1
        st.session_state.result = "🤖 BOT WINS THIS ROUND!"

    # Update History
    st.session_state.history.append({
        "You": st.session_state.me,
        "Bot": st.session_state.bot
    })

    # Check for Game End
    if st.session_state.me >= 5:
        st.session_state.game_over = True
        st.balloons()
    elif st.session_state.bot >= 5:
        st.session_state.game_over = True

def reset_game():
    for key, value in states.items():
        st.session_state[key] = value
    st.rerun()

# ------------------ STYLING ------------------
st.markdown("""
    <style>
    @import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap');
    
    .main { background-color: #0d0d0d; }
    
    .title {
        text-align: center;
        font-family: 'Press Start 2P', cursive;
        color: #00ffcc;
        font-size: 40px;
        padding: 20px;
        text-shadow: 3px 3px #ff00ff;
    }
    
    .score-container {
        display: flex;
        justify-content: space-around;
        background: rgba(255, 255, 255, 0.1);
        border: 2px solid #00ffcc;
        border-radius: 10px;
        padding: 15px;
        margin-bottom: 20px;
    }
    
    .score-box {
        text-align: center;
        font-family: monospace;
        font-size: 24px;
        color: white;
    }

    .result-text {
        text-align: center;
        font-size: 28px;
        font-weight: bold;
        color: #ffff00;
        text-shadow: 0 0 10px #ffff00;
        margin: 20px 0;
    }
    
    /* Make buttons look more 'arcade' */
    .stButton>button {
        width: 100%;
        border-radius: 5px;
        height: 3em;
        background-color: #262626;
        color: #00ffcc;
        border: 2px solid #00ffcc;
        font-weight: bold;
    }
    .stButton>button:hover {
        background-color: #00ffcc;
        color: black;
        box-shadow: 0 0 15px #00ffcc;
    }
    </style>
    """, unsafe_allow_html=True)

# ------------------ UI LAYOUT ------------------
st.markdown('<div class="title">RETRO RPS</div>', unsafe_allow_html=True)

# Scoreboard
st.markdown(f"""
    <div class="score-container">
        <div class="score-box">PLAYER<br><span style="font-size:40px; color:#00ffcc;">{st.session_state.me}</span></div>
        <div class="score-box">VS</div>
        <div class="score-box">BOT<br><span style="font-size:40px; color:#ff00ff;">{st.session_state.bot}</span></div>
    </div>
""", unsafe_allow_html=True)

# Game Over Message
if st.session_state.game_over:
    if st.session_state.me >= 5:
        st.success("🏆 CHAMPION! YOU DEFEATED THE MACHINE!")
    else:
        st.error("💀 GAME OVER: THE MACHINE HAS WON.")
    if st.button("REINSERT COIN (RESET)"):
        reset_game()
else:
    # Action Buttons
    col1, col2, col3 = st.columns(3)
    with col1:
        if st.button("🪨 ROCK"): play("rock")
    with col2:
        if st.button("📄 PAPER"): play("paper")
    with col3:
        if st.button("✂️ SCISSORS"): play("scissor")

# Visual feedback of moves
if st.session_state.user_move:
    c1, c2 = st.columns(2)
    c1.metric("Your Move", st.session_state.user_move.upper())
    c2.metric("Bot's Move", st.session_state.bot_move.upper())
    st.markdown(f'<div class="result-text">{st.session_state.result}</div>', unsafe_allow_html=True)

# ------------------ DATA VIS ------------------
with st.expander("📊 MATCH ANALYTICS"):
    if len(st.session_state.history) > 1:
        df = pd.DataFrame(st.session_state.history)
        st.line_chart(df, height=200)
    else:
        st.write("First to 5 wins. Start playing to see the chart!")

# Sidebar Reset
with st.sidebar:
    st.header("Settings")
    if st.button("Hard Reset"):
        reset_game()